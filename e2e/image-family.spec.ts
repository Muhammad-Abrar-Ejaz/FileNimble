import { test, expect, type Page, type Download } from '@playwright/test';
import JSZip from 'jszip';
import { PDFDocument, PDFArray, PDFRawStream, decodePDFRawStream } from 'pdf-lib';

// Project-generated patterns; no third-party image assets or external URLs.
async function fixture(page: Page, format = 'png', width = 80, height = 60) {
  const mimeType = format === 'jpg' ? 'image/jpeg' : `image/${format}`;
  const base64 = await page.evaluate(({ mimeType, width, height }) => {
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    // Transparent left half; detailed opaque right half makes quality changes measurable.
    const pixels = ctx.createImageData(width, height);
    for (let y = 0; y < height; y++) for (let x = Math.floor(width / 2); x < width; x++) {
      const i = (y * width + x) * 4;
      pixels.data.set([(x * 37 + y * 13) % 256, (x * 11 + y * 41) % 256, (x * 53 + y * 7) % 256, 255], i);
    }
    ctx.putImageData(pixels, 0, 0);
    const data = canvas.toDataURL(mimeType, 0.95).split(',')[1];
    canvas.width = 0; canvas.height = 0;
    return data;
  }, { mimeType, width, height });
  return { name: `pattern.${format}`, mimeType, buffer: Buffer.from(base64, 'base64') };
}
async function readDownload(download: Download) {
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  expect(await download.failure()).toBeNull();
  return Buffer.concat(chunks);
}
async function downloadResult(page: Page, index = 0) {
  const pending = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download', exact: true }).nth(index).click();
  return readDownload(await pending);
}
function signature(bytes: Buffer, format: string) {
  if (format === 'png') expect([...bytes.subarray(0, 8)]).toEqual([137,80,78,71,13,10,26,10]);
  if (format === 'jpg') expect([...bytes.subarray(0, 3)]).toEqual([255,216,255]);
  if (format === 'webp') { expect(bytes.toString('ascii', 0, 4)).toBe('RIFF'); expect(bytes.toString('ascii', 8, 12)).toBe('WEBP'); }
}
async function inspectPixels(page: Page, bytes: Buffer) {
  return page.evaluate(async raw => {
    const image = await createImageBitmap(new Blob([new Uint8Array(raw)]));
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext('2d')!; ctx.drawImage(image, 0, 0);
    const result = { width: image.width, height: image.height, pixel: [...ctx.getImageData(2, 2, 1, 1).data] };
    image.close(); canvas.width = 0; canvas.height = 0; return result;
  }, [...bytes]);
}
async function convert(page: Page, name: string | RegExp = /^Convert to /) {
  await page.getByRole('button', { name }).click();
  await expect(page.getByRole('heading', { name: /Conversion Results|Conversion Complete!/ })).toBeVisible();
}

const pairs = [
  ['jpg-to-png','JPG to PNG Converter','jpg','png'],
  ['jpg-to-webp','JPG to WebP Converter','jpg','webp'],
  ['png-to-webp','PNG to WebP Converter','png','webp'],
  ['webp-to-jpg','WebP to JPG Converter','webp','jpg'],
  ['webp-to-png','WebP to PNG Converter','webp','png'],
  ['png-to-jpg','PNG to JPG Converter','png','jpg'],
];

test('PNG to JPG clear and cancel discard selected files and late results', async ({ page }) => {
  await page.addInitScript(() => {
    const pending: Array<() => void> = [];
    const live = new Set<string>();
    const encode = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function(callback, type, quality) {
      encode.call(this, blob => pending.push(() => callback(blob)), type, quality);
    };
    const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = blob => { const url = create(blob); live.add(url); return url; };
    URL.revokeObjectURL = url => { live.delete(url); revoke(url); };
    Object.assign(window, { pendingEncodings: pending, liveImageUrls: live });
  });
  await page.goto('/png-to-jpg');
  const image = await fixture(page);
  await page.locator('input[type=file]').setInputFiles(image);
  await page.getByRole('button', { name: 'Clear files', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Selected file list' })).toHaveCount(0);
  await page.locator('input[type=file]').setInputFiles(image);
  await page.getByRole('button', { name: 'Convert to JPG' }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as {pendingEncodings: unknown[]}).pendingEncodings.length)).toBe(1);
  await page.getByRole('button', { name: 'Cancel processing' }).click();
  await page.evaluate(() => (window as unknown as {pendingEncodings: Array<() => void>}).pendingEncodings.pop()!());
  await expect.poll(() => page.evaluate(() => (window as unknown as {liveImageUrls: Set<string>}).liveImageUrls.size)).toBe(0);
  await expect(page.getByRole('heading', { name: 'Conversion Cancelled' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Download', exact: true })).toHaveCount(0);
});

test('PNG to JPG black/custom backgrounds, quality, safe ZIP files and cleanup', async ({ page }) => {
  await page.goto('/png-to-jpg');
  const image = await fixture(page, 'png', 160, 120);
  const sizes: number[] = [];
  for (const quality of [20, 95]) {
    await page.locator('input[type=file]').setInputFiles([{ ...image, name: 'photo #1.png' }, { ...image, name: 'second.png' }]);
    await page.locator('#jpg-quality-slider').fill(String(quality));
    if (quality === 20) await page.getByRole('button', { name: 'Black', exact: true }).click();
    else await page.locator('input[type=color]').fill('#ff0000');
    await convert(page);
    const bytes = await downloadResult(page); signature(bytes, 'jpg'); sizes.push(bytes.length);
    const { pixel } = await inspectPixels(page, bytes);
    const expected = quality === 20 ? [0, 0, 0] : [255, 0, 0];
    pixel.slice(0, 3).forEach((value, index) => expect(Math.abs(value - expected[index])).toBeLessThan(8));
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download All (ZIP)' }).click();
    const zip = await JSZip.loadAsync(await readDownload(await pending));
    expect(Object.keys(zip.files).sort()).toEqual(['photo__1.jpg', 'second.jpg']);
    for (const entry of Object.values(zip.files)) signature(await entry.async('nodebuffer'), 'jpg');
    await page.getByRole('button', { name: 'Convert Another' }).click();
  }
  expect(sizes[1]).toBeGreaterThan(sizes[0]);
});

for (const [slug, title, input, output] of pairs) {
  test(`${slug}: real download, signature, dimensions, alpha and privacy`, async ({ page }) => {
    await page.goto(`/${slug}`);
    await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
    await expect(page).toHaveTitle(new RegExp(title));
    await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', new RegExp(`/${slug}$`));
    await expect(page.getByText('Runs in browser').first()).toBeVisible();
    const uploads: string[] = [];
    page.on('request', request => { if (/^https?:/.test(request.url()) && request.postDataBuffer()?.length) uploads.push(request.url()); });
    await page.locator('input[type=file]').setInputFiles(await fixture(page, input));
    if (output === 'webp') await page.getByLabel('Image Quality Slider').fill('70');
    await convert(page);
    const bytes = await downloadResult(page); signature(bytes, output);
    const result = await inspectPixels(page, bytes);
    expect([result.width,result.height]).toEqual([80,60]);
    expect(result.pixel[3]).toBe(output === 'jpg' || input === 'jpg' ? 255 : 0);
    if (output === 'jpg') expect(result.pixel.slice(0, 3).every(c => c > 248)).toBe(true);
    expect(uploads).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

for (const background of ['Black', 'Custom Color']) {
  test(`WebP alpha flattens onto ${background}`, async ({ page }) => {
    await page.goto('/webp-to-jpg');
    await page.locator('input[type=file]').setInputFiles(await fixture(page, 'webp'));
    if (background === 'Black') await page.getByRole('radio', { name: 'Black' }).click();
    else await page.getByLabel('Custom Color', { exact: true }).fill('#ff0000');
    await convert(page);
    const { pixel } = await inspectPixels(page, await downloadResult(page));
    const expected = background === 'Black' ? [0,0,0] : [255,0,0];
    pixel.slice(0,3).forEach((c,i) => expect(Math.abs(c - expected[i])).toBeLessThan(6));
  });
}

test('batch: partial malformed failure, duplicate names, ZIP entries, reset cleanup', async ({ page }) => {
  await page.addInitScript(() => {
    const live = new Set<string>();
    const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = object => { const url = create(object); live.add(url); return url; };
    URL.revokeObjectURL = url => { live.delete(url); revoke(url); };
    Object.assign(window, { liveImageUrls: live });
  });
  await page.goto('/jpg-to-png');
  const good = await fixture(page, 'jpg');
  await page.locator('input[type=file]').setInputFiles([
    good, good, { ...good, name: 'pattern-1.jpg' },
    { ...good, name: 'broken.jpg', buffer: Buffer.from([255,216,255,0,0,0,0,0,0,0,0,0]) },
  ]);
  await convert(page, /Convert 4 Files/);
  await expect(page.getByRole('alert').filter({ hasText: 'broken.jpg' })).toContainText('Failed to decode');
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download All as ZIP' }).click();
  const zip = await JSZip.loadAsync(await readDownload(await pending));
  expect(Object.keys(zip.files)).toHaveLength(3);
  for (const file of Object.values(zip.files)) signature(await file.async('nodebuffer'), 'png');
  await page.getByRole('button', { name: 'Convert more files' }).click();
  await expect(page.getByRole('link', { name: 'Download', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as {liveImageUrls: Set<string>}).liveImageUrls.size)).toBe(0);
  await page.locator('input[type=file]').setInputFiles(good);
  await convert(page);
});

test('spoofed extension with missing MIME cannot pass route validation', async ({ page }) => {
  await page.goto('/jpg-to-png');
  const png = await fixture(page);
  // DataTransfer preserves an empty MIME; setInputFiles may infer one from the extension.
  await page.locator('input[type=file]').evaluate((input, bytes) => {
    const transfer = new DataTransfer(); transfer.items.add(new File([new Uint8Array(bytes)], 'spoof.jpg'));
    (input as HTMLInputElement).files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, [...png.buffer]);
  await expect(page.getByText('File header does not match declared type')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Convert to PNG' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Download', exact: true })).toHaveCount(0);
});

for (const [locked, width, height] of [[true,40,30],[false,40,20]] as const) {
  test(`resize: aspect lock ${locked}, PNG format and alpha`, async ({ page }) => {
    await page.goto('/image-resize');
    await page.locator('input[type=file]').setInputFiles(await fixture(page));
    await page.getByLabel('Width (px)', { exact: true }).fill('40');
    await page.getByLabel('Height (px)', { exact: true }).fill(locked ? '' : '20');
    await page.getByLabel('Lock Aspect Ratio').setChecked(locked);
    await convert(page, 'Resize Images');
    const bytes = await downloadResult(page); signature(bytes, 'png');
    const result = await inspectPixels(page, bytes);
    expect([result.width,result.height,result.pixel[3]]).toEqual([width,height,0]);
  });
}

test('resize: no automatic upscale; explicit opt-in enlarges', async ({ page }) => {
  await page.goto('/image-resize');
  const image = await fixture(page);
  for (const enabled of [false,true]) {
    await page.locator('input[type=file]').setInputFiles(image);
    await page.getByLabel('Width (px)', { exact: true }).fill('160');
    await page.getByLabel('Allow upscaling').setChecked(enabled);
    await convert(page, 'Resize Images');
    const result = await inspectPixels(page, await downloadResult(page));
    expect([result.width,result.height]).toEqual(enabled ? [160,120] : [80,60]);
    await page.getByRole('button', { name: 'Convert more files' }).click();
  }
});

test('compress: PNG hides quality, real sizes and WebP quality changes', async ({ page }) => {
  await page.goto('/image-compress');
  const input = await fixture(page, 'png', 240, 160);
  await page.locator('input[type=file]').setInputFiles(input);
  await expect(page.getByLabel('Image Quality Slider')).toHaveCount(0);
  await convert(page, 'Compress Images');
  const png = await downloadResult(page); signature(png, 'png');
  const change = Math.round((input.buffer.length - png.length) / input.buffer.length * 100);
  await expect(page.getByText(change > 0 ? `${change}% smaller` : change < 0 ? `${-change}% larger` : '0% reduction', { exact: true })).toBeVisible();
  const outputs: Buffer[] = [];
  for (const quality of ['20','95']) {
    await page.getByRole('button', { name: 'Convert more files' }).click();
    await page.locator('input[type=file]').setInputFiles(input);
    await page.getByRole('button', { name: 'Convert to Lossy WebP', exact: true }).click();
    await page.getByLabel('Image Quality Slider').fill(quality);
    await convert(page, 'Compress Images');
    outputs.push(await downloadResult(page));
  }
  outputs.forEach(bytes => signature(bytes, 'webp'));
  expect(outputs[0].equals(outputs[1])).toBe(false);
  expect(outputs[0].length).toBeLessThan(outputs[1].length);
});

for (const ratio of ['1:1','4:3','16:9']) {
  test(`crop: ${ratio} exports exact pixels and resets`, async ({ page }) => {
    await page.goto('/image-crop');
    await page.locator('input[type=file]').setInputFiles(await fixture(page, 'png', 160, 120));
    await expect(page.getByAltText('Crop preview')).toBeVisible();
    await page.getByRole('button', { name: ratio, exact: true }).click();
    const width = Number(await page.getByLabel('Crop Width (px)', { exact: true }).inputValue());
    const height = Number(await page.getByLabel('Crop Height (px)', { exact: true }).inputValue());
    await convert(page, 'Crop Image Now');
    const result = await inspectPixels(page, await downloadResult(page));
    expect([result.width,result.height]).toEqual([width,height]);
    expect(width / height).toBeCloseTo(ratio === '1:1' ? 1 : ratio === '4:3' ? 4/3 : 16/9, 1);
  });
}

test('crop: drag resize and keyboard movement produce a real free crop', async ({ page, isMobile }, testInfo) => {
  await page.goto('/image-crop');
  await page.locator('input[type=file]').setInputFiles(await fixture(page, 'png', 400, 300));
  const handle = page.getByRole('button', { name: 'Resize crop selection' });
  await handle.scrollIntoViewIfNeeded();
  const bounds = (await handle.boundingBox())!;
  if (isMobile) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: bounds.x - 65, y: bounds.y - 45 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
  } else {
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.mouse.down(); await page.mouse.move(bounds.x - 65, bounds.y - 45, { steps: 5 }); await page.mouse.up();
  }
  const width = Number(await page.getByLabel('Crop Width (px)', { exact: true }).inputValue());
  expect(width).toBeLessThan(400);
  await page.getByRole('group', { name: 'Crop selection', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByLabel('X Offset (px)', { exact: true })).toHaveValue('1');
  await page.getByRole('group', { name: 'Crop selection', exact: true }).screenshot({ path: testInfo.outputPath('crop-preview.png') });
  await convert(page, 'Crop Image Now');
  expect((await inspectPixels(page, await downloadResult(page))).width).toBe(width);
  await page.getByRole('button', { name: 'Convert more files' }).click();
  await page.locator('input[type=file]').setInputFiles(await fixture(page, 'png', 40, 30));
  await page.getByRole('button', { name: '1:1', exact: true }).click();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.getByLabel('Crop Width (px)', { exact: true })).toHaveValue('40');
});

test('PDF: reordered JPG/PNG/WebP produce a real three-page Fit PDF', async ({ page }) => {
  await page.goto('/image-to-pdf');
  const files = [await fixture(page,'jpg',80,60), await fixture(page,'png',40,30), await fixture(page,'webp',100,50)];
  await page.locator('input[type=file]').setInputFiles(files);
  await page.getByRole('button', { name: 'Move pattern.webp up' }).click();
  await page.getByRole('button', { name: 'Move pattern.webp up' }).click();
  await page.getByLabel('Page Format', { exact: true }).selectOption('fit');
  await page.getByLabel('Page Margins', { exact: true }).selectOption('0');
  await convert(page, 'Convert All into 1 PDF');
  const bytes = await downloadResult(page); expect(bytes.toString('ascii',0,5)).toBe('%PDF-');
  const pdf = await PDFDocument.load(bytes);
  expect(pdf.getPages().map(p => [p.getWidth(),p.getHeight()])).toEqual([[100,50],[80,60],[40,30]]);
});

for (const size of ['a4','letter']) {
  test(`PDF: ${size}, landscape and margins`, async ({ page }) => {
    await page.goto('/image-to-pdf');
    await page.locator('input[type=file]').setInputFiles(await fixture(page,'png',800,600));
    await page.getByLabel('Page Format', { exact: true }).selectOption(size);
    await page.getByLabel('Orientation', { exact: true }).selectOption('landscape');
    await page.getByLabel('Page Margins', { exact: true }).selectOption('40');
    await convert(page, 'Convert All into 1 PDF');
    const pdf = await PDFDocument.load(await downloadResult(page));
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getPage(0).getWidth()).toBeCloseTo(size === 'a4' ? 841.89 : 792);
    expect(pdf.getPage(0).getHeight()).toBeCloseTo(size === 'a4' ? 595.28 : 612);
    const contents = pdf.getPage(0).node.Contents() as PDFArray;
    const stream = pdf.context.lookup(contents.get(0));
    if (!(stream instanceof PDFRawStream)) throw new Error('Expected a PDF content stream');
    const commands = Buffer.from(decodePDFRawStream(stream).decode()).toString();
    const scale = Math.min((pdf.getPage(0).getWidth()-80)/800, (pdf.getPage(0).getHeight()-80)/600, 1);
    // The image transform must use the actual drawable area after 40pt margins.
    expect(commands).toContain(`${800*scale} 0 0 ${600*scale} 0 0 cm`);
  });
}

test('all Phase 3 routes have unique H1/title/canonical, help, FAQ and no mobile overflow', async ({ page }) => {
  const titles = new Set<string>();
  for (const slug of ['jpg-to-png','jpg-to-webp','png-to-webp','webp-to-jpg','webp-to-png','image-resize','image-compress','image-crop','image-to-pdf']) {
    await page.goto(`/${slug}`);
    await expect(page.locator('h1')).toHaveCount(1);
    expect(titles.has(await page.title())).toBe(false); titles.add(await page.title());
    await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href',new RegExp(`/${slug}$`));
    await expect(page.getByRole('heading', { name: /How to / }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Frequently Asked Questions' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.goto('/heic-to-jpg');
  await expect(page.getByRole('heading', { level:1, name: 'HEIC to JPG — Planned' })).toBeVisible();
  await expect(page.locator('meta[name=robots]')).toHaveAttribute('content',/noindex/);
  await expect(page.locator('input[type=file]')).toHaveCount(0);
  // Browser badges belong only to the related live-tool cards, never HEIC itself.
  expect(await page.getByText('Runs in browser', { exact: true }).count()).toBe(await page.locator('article').getByText('Runs in browser', { exact: true }).count());
});

test('resize batch keeps JPG, PNG and WebP formats', async ({ page }) => {
  await page.goto('/image-resize');
  await page.locator('input[type=file]').setInputFiles(await Promise.all(['jpg','png','webp'].map(format => fixture(page,format))));
  await page.getByLabel('Width (px)', { exact:true }).fill('40');
  await convert(page, 'Resize Images');
  for (const [i,format] of ['jpg','png','webp'].entries()) {
    const bytes = await downloadResult(page,i); signature(bytes,format);
    const image = await inspectPixels(page,bytes); expect([image.width,image.height]).toEqual([40,30]);
  }
});

test('PDF separate option creates downloadable PDFs and a PDF ZIP', async ({ page }) => {
  await page.goto('/image-to-pdf');
  await page.locator('input[type=file]').setInputFiles([await fixture(page,'jpg'),await fixture(page,'png')]);
  await page.getByRole('checkbox', { name: /Merge all uploaded/ }).uncheck();
  await convert(page,'Convert to Separate PDFs');
  const pending = page.waitForEvent('download');
  await page.getByRole('button',{name:'Download All as ZIP'}).click();
  const zip = await JSZip.loadAsync(await readDownload(await pending));
  expect(Object.keys(zip.files)).toHaveLength(2);
  for (const file of Object.values(zip.files)) expect((await PDFDocument.load(await file.async('uint8array'))).getPageCount()).toBe(1);
});
