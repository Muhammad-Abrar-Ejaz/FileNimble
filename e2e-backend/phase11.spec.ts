import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import JSZip from 'jszip';

const docker = process.env.DOCKER_BIN || (process.platform === 'win32' ? path.join(process.env.LOCALAPPDATA!, 'Programs/DockerDesktop/resources/bin/docker.exe') : 'docker');
const cases = [
  ['wav-to-flac', 'wav', 'audio/wav', 'flac'], ['flac-to-wav', 'flac', 'audio/flac', 'wav'],
  ['tar-to-zip', 'tar', 'application/x-tar', 'zip'],
  ['zip-to-tar', 'zip', 'application/zip', 'tar'],
] as const;
test.setTimeout(120000);

for (const [slug, extension, mime, output] of cases) {
  test(`${slug}: explicit upload and real validated download`, async ({ page }) => {
    let creates = 0;
    page.on('request', request => { if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/v1/jobs') creates++; });
    await page.goto(`/${slug}`);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1').locator('..').getByText('Secure server processing')).toBeVisible();
    await page.locator('input[type=file]').setInputFiles({ name: `owned.${extension}`, mimeType: mime, buffer: await readFile(`tmp/phase11-fixtures/input.${extension}`) });
    const action = page.getByRole('button', { name: 'Upload and convert' });
    await expect(action).toBeEnabled();
    expect(creates).toBe(0);
    await action.focus(); await page.keyboard.press('Enter');
    await expect(page.getByRole('region', { name: 'Conversion completed' })).toBeVisible({ timeout: 90000 });
    const event = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download', exact: true }).click();
    const download = await event;
    expect(download.suggestedFilename()).toBe(`${slug}-result.${output}`);
    const bytes = await readFile((await download.path())!);
    expect(bytes.length).toBeGreaterThan(44);
    if (output === 'zip') {
      const zip = await JSZip.loadAsync(bytes, { checkCRC32: true });
      expect(await zip.file('notes/one.txt')!.async('string')).toBe('FileNimble first file\n');
    } else if (output === 'tar') {
      expect(bytes.subarray(257, 262).toString()).toBe('ustar');
      expect(bytes.includes(Buffer.from('FileNimble first file\n'))).toBe(true);
    } else {
      // Independent parser on the actual browser download; no user file is involved.
      const parsed = JSON.parse(execFileSync(docker, ['run', '--rm', '-i', '--network', 'none', '--read-only', '--cap-drop=ALL', '--security-opt=no-new-privileges', '--memory=256m', '--pids-limit=64', '--entrypoint', '/usr/local/bin/ffprobe', 'filenimble-media:phase11', '-v', 'error', '-show_streams', '-of', 'json', '-i', 'pipe:0'], { input: bytes, maxBuffer: 1024 * 1024 }).toString());
      expect(parsed.streams).toHaveLength(1);
      expect(parsed.streams[0].codec_name).toBe(output === 'flac' ? 'flac' : 'pcm_s16le');
      expect(parsed.streams[0].sample_rate).toBe('16000');
    }
    await page.getByRole('button', { name: 'Convert Another' }).click();
    await expect(page.getByRole('region', { name: 'Conversion completed' })).toHaveCount(0);
    await download.delete();
  });
}

test('hostile archive fails without a download and leaves navigation usable', async ({ page }) => {
  await page.goto('/zip-to-tar');
  await page.locator('input[type=file]').setInputFiles({ name: 'unsafe.zip', mimeType: 'application/zip', buffer: await readFile('tmp/phase11-fixtures/unsafe.zip') });
  await page.getByRole('button', { name: 'Upload and convert' }).click();
  await expect(page.getByText(/could not be converted within/i)).toBeVisible({ timeout: 90000 });
  await expect(page.getByRole('button', { name: 'Download', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const slug of ['video-mute', 'video-to-wav', 'video-to-frames']) {
  test(`${slug}: planned licensing gate has no uploader`, async ({ page }) => {
    await page.goto(`/${slug}`);
    await expect(page.getByRole('heading', { name: /planned/i })).toBeVisible();
    await expect(page.locator('input[type=file]')).toHaveCount(0);
    await expect(page.getByText(/commercial patent scope.*unresolved/i)).toBeVisible();
  });
}
