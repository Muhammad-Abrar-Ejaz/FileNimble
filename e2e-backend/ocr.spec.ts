import { test, expect } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import { readFile } from 'node:fs/promises';

test.setTimeout(120000);

for (const slug of ['image-to-text', 'pdf-to-text', 'ocr-pdf']) {
  test(`${slug}: real OCR download, explicit upload and accessible options`, async ({ page }) => {
    let creates = 0;
    page.on('request', request => { if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/v1/jobs') creates++; });
    await page.goto('/' + slug);
    const converterHeader = page.getByRole('heading', { level: 1 }).locator('..');
    await expect(converterHeader.getByText('Runs in browser', { exact: true })).toHaveCount(0);
    const images = await page.evaluate(() => {
      return ['FIRST PAGE ALPHA', 'SECOND PAGE BETA'].map(marker => {
        const canvas = document.createElement('canvas'); canvas.width = 1400; canvas.height = 900;
        const context = canvas.getContext('2d')!;
        context.fillStyle = 'white'; context.fillRect(0, 0, 1400, 900);
        context.fillStyle = 'black'; context.font = '38px Arial';
        [marker, 'FileNimble printed English recognition test.', 'Invoice number 4827. Total amount 125 dollars.', 'The quick brown fox jumps over the lazy dog.', 'Please review every result before sharing.'].forEach((line, index) => context.fillText(line, 50, 90 + index * 120));
        return canvas.toDataURL('image/png').split(',')[1];
      });
    });
    let input: Buffer;
    if (slug === 'image-to-text') input = Buffer.from(images[0], 'base64');
    else {
      const document = await PDFDocument.create();
      for (const base64 of images) {
        const image = await document.embedPng(Buffer.from(base64, 'base64'));
        document.addPage([700, 450]).drawImage(image, { x: 0, y: 0, width: 700, height: 450 });
      }
      input = Buffer.from(await document.save());
    }
    await expect(page.getByLabel('Recognition language')).toHaveValue('eng');
    await expect(page.getByLabel('Recognition language').locator('option')).toHaveCount(1);
    const cleanup = page.getByLabel('Deskew and clean up the scan');
    await cleanup.focus(); await page.keyboard.press('Space'); await expect(cleanup).not.toBeChecked();
    await page.locator('input[type=file]').setInputFiles({ name: slug === 'image-to-text' ? 'owned.png' : 'owned.pdf', mimeType: slug === 'image-to-text' ? 'image/png' : 'application/pdf', buffer: input });
    const action = page.getByRole('button', { name: 'Upload and convert' });
    await expect(action).toBeEnabled();
    expect(creates).toBe(0);
    await action.focus(); await page.keyboard.press('Enter');
    await expect(page.getByRole('region', { name: 'Conversion completed' })).toBeVisible({ timeout: 90000 });
    const downloadEvent = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download', exact: true }).click();
    const download = await downloadEvent;
    expect(download.suggestedFilename()).toBe(slug + '-result.' + (slug === 'ocr-pdf' ? 'pdf' : 'txt'));
    const bytes = await readFile((await download.path())!);
    if (slug === 'ocr-pdf') {
      const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const loading = getDocument({ data: new Uint8Array(bytes), useSystemFonts: true });
      const pdf = await loading.promise;
      try {
        expect(pdf.numPages).toBe(2);
        for (let index = 1; index <= 2; index++) {
          const content = await (await pdf.getPage(index)).getTextContent();
          const text = content.items.map(item => 'str' in item ? item.str : '').join(' ');
          expect(text).toContain(index === 1 ? 'ALPHA' : 'BETA');
        }
      } finally { await loading.destroy(); }
    } else {
      const text = bytes.toString('utf8'); expect(text).toContain('4827'); expect(text).toContain('125');
      if (slug === 'pdf-to-text') expect(text.indexOf('ALPHA')).toBeLessThan(text.indexOf('BETA'));
    }
    await page.getByRole('button', { name: 'Convert Another' }).click();
    await expect(page.getByRole('region', { name: 'Conversion completed' })).toHaveCount(0);
    await download.delete();
  });
}

test('OCR rejects a spoofed PNG before uploading', async ({ page }) => {
  await page.goto('/image-to-text');
  await page.locator('input[type=file]').setInputFiles({ name: 'fake.png', mimeType: 'image/png', buffer: Buffer.from('not an image') });
  await expect(page.getByRole('button', { name: 'Upload and convert' })).toHaveCount(0);
  await expect(page.getByText(/header|signature|match/i).first()).toBeVisible();
});
