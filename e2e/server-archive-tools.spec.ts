import { expect, test } from '@playwright/test';
import JSZip from 'jszip';
import { readFile } from 'node:fs/promises';

const JOB_ID = '12345678-1234-4234-8234-123456789012';
const OUTPUT_ID = '22345678-1234-4234-8234-123456789012';
const CONTENT = Buffer.from('FileNimble synthetic archive integration fixture\n');
const TRANSFER_ORIGIN = 'https://transfer.example.test';

function makeTar() {
  const header = Buffer.alloc(512, 0);
  header.write('notes/fixture.txt', 0, 'ascii');
  header.write('0000644\0', 100, 'ascii');
  header.write('0000000\0', 108, 'ascii');
  header.write('0000000\0', 116, 'ascii');
  header.write(CONTENT.length.toString(8).padStart(11, '0') + '\0', 124, 'ascii');
  header.write('00000000000\0', 136, 'ascii');
  header.fill(0x20, 148, 156);
  header.write('0', 156, 'ascii');
  header.write('ustar\0', 257, 'ascii');
  header.write('00', 263, 'ascii');
  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  header.write(checksum.toString(8).padStart(6, '0') + '\0 ', 148, 'ascii');
  const paddedContent = Buffer.alloc(Math.ceil(CONTENT.length / 512) * 512);
  CONTENT.copy(paddedContent);
  return Buffer.concat([header, paddedContent, Buffer.alloc(1024)]);
}

async function makeZip() {
  const zip = new JSZip();
  zip.file('notes/fixture.txt', CONTENT);
  return Buffer.from(await zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' }));
}

async function prepareMockBackend(page: import('@playwright/test').Page, slug: 'tar-to-zip' | 'zip-to-tar', input: Buffer, output: Buffer) {
  const origin = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
  let uploaded: Buffer | undefined;
  await page.route('**/api/v1/jobs**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/v1/jobs' && request.method() === 'POST') {
      expect(request.headers()['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/i);
      expect(request.postDataJSON().tool).toBe(slug);
      await route.fulfill({ status: 201, headers: { 'Content-Type': 'application/json', 'Set-Cookie': 'fn_session=synthetic; HttpOnly; SameSite=Strict; Path=/api/v1' }, json: {
        jobId: JOB_ID, state: 'UPLOADING', expiresAt: new Date(Date.now() + 60_000).toISOString(),
        uploads: [{ fileId: OUTPUT_ID, method: 'PUT', url: `${origin}/__transfer/upload/${slug}`, headers: { 'Content-Type': 'application/octet-stream' } }],
      } });
    } else if (path.endsWith('/complete-upload')) {
      expect(request.method()).toBe('POST');
      await route.fulfill({ status: 200, json: { state: 'QUEUED' } });
    } else if (path === `/api/v1/jobs/${JOB_ID}` && request.method() === 'GET') {
      await route.fulfill({ status: 200, json: { jobId: JOB_ID, state: 'COMPLETED', expiresAt: new Date(Date.now() + 60_000).toISOString(), files: [{ fileId: OUTPUT_ID, bytes: output.length, mediaType: slug === 'tar-to-zip' ? 'application/zip' : 'application/x-tar' }] } });
    } else if (path.endsWith('/download-token')) {
      expect(request.method()).toBe('POST');
      await route.fulfill({ status: 200, json: { url: `${TRANSFER_ORIGIN}/__transfer/download/${slug}`, expiresIn: 60 } });
    } else if (request.method() === 'DELETE' || path.endsWith('/cancel')) {
      await route.fulfill({ status: 200, json: { state: 'CANCELLED' } });
    } else {
      await route.fulfill({ status: 404, json: { error: 'INVALID_REQUEST', message: 'Unknown endpoint.' } });
    }
  });
  await page.route('**/__transfer/upload/**', async route => {
    expect(route.request().method()).toBe('PUT');
    expect(route.request().headers()['content-type']).toBe('application/octet-stream');
    uploaded = route.request().postDataBuffer() || undefined;
    await route.fulfill({ status: 204 });
  });
  await page.route('**/__transfer/download/**', async route => {
    await route.fulfill({ status: 200, headers: {
      'Content-Type': slug === 'tar-to-zip' ? 'application/zip' : 'application/x-tar',
      'Content-Disposition': `attachment; filename="${slug}-result.${slug === 'tar-to-zip' ? 'zip' : 'tar'}"`,
    }, body: output });
  });
  return { getUploaded: () => uploaded };
}

for (const slug of ['tar-to-zip', 'zip-to-tar'] as const) {
  test(`${slug} completes the browser upload, job, status and private download flow`, async ({ page }, testInfo) => {
    const input = slug === 'tar-to-zip' ? makeTar() : await makeZip();
    let output: Buffer;
    if (slug === 'tar-to-zip') {
      const zip = new JSZip(); zip.file('notes/fixture.txt', CONTENT);
      output = Buffer.from(await zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' }));
    } else output = makeTar();
    const backend = await prepareMockBackend(page, slug, input, output);
    await page.goto(`/${slug}`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await page.getByLabel('Upload files').setInputFiles({ name: slug === 'tar-to-zip' ? 'fixture.tar' : 'fixture.zip', mimeType: slug === 'tar-to-zip' ? 'application/x-tar' : 'application/zip', buffer: input });
    await expect(page.getByText('1 file ready to process')).toBeVisible();
    await page.getByRole('button', { name: 'Upload and convert' }).click();
    await expect(page.getByRole('button', { name: 'Download', exact: true })).toBeVisible();
    expect(backend.getUploaded()).toEqual(input);
    await expect(page.getByRole('status')).toContainText('Your validated result is ready to download.');

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download', exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(`${slug}-result.${slug === 'tar-to-zip' ? 'zip' : 'tar'}`);
    const path = testInfo.outputPath(`${slug}-result.${slug === 'tar-to-zip' ? 'zip' : 'tar'}`);
    await download.saveAs(path);
    const downloaded = await readFile(path);
    if (slug === 'tar-to-zip') {
      const zip = await JSZip.loadAsync(downloaded);
      expect(await zip.file('notes/fixture.txt')?.async('nodebuffer')).toEqual(CONTENT);
    } else {
      expect(downloaded.subarray(257, 262).toString('ascii')).toBe('ustar');
      expect(downloaded.subarray(512, 512 + CONTENT.length)).toEqual(CONTENT);
    }
    expect(downloaded).toEqual(output);
  });
}

test('OCR stays planned in the public website while the archive pages stay available', async ({ page }) => {
  await page.goto('/ocr-pdf', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /Make a Scanned PDF Searchable — Planned/ })).toBeVisible();
  await expect(page.getByLabel('Upload files')).toHaveCount(0);
  await page.goto('/tools', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('link', { name: /Convert TAR to ZIP/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Make a Scanned PDF Searchable/ })).toHaveCount(0);
});

test('server configuration failure is shown without attempting an upload', async ({ page }) => {
  await page.route('**/api/v1/jobs', route => route.fulfill({ status: 503, json: { error: 'SERVICE_UNAVAILABLE', message: 'Server processing is not configured.' } }));
  await page.goto('/tar-to-zip', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Upload files').setInputFiles({ name: 'fixture.tar', mimeType: 'application/x-tar', buffer: makeTar() });
  await expect(page.getByText('1 file ready to process')).toBeVisible();
  await page.getByRole('button', { name: 'Upload and convert' }).click();
  await expect(page.getByText('Server processing is not configured.', { exact: true })).toBeVisible();
  await expect(page.getByText(/Uploading to temporary private storage/)).toHaveCount(0);
});
