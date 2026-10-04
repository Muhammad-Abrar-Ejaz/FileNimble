import { test, expect, type Page, type Download } from '@playwright/test';
import { PDFDocument, PDFArray, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import JSZip from 'jszip';
import { makePdf } from '../src/lib/converters/pdf/fixtures';

async function downloadBytes(download: Download) {
  const stream = await download.createReadStream(); const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  expect(await download.failure()).toBeNull(); return Buffer.concat(chunks);
}
async function result(page: Page, index = 0) {
  const pending = page.waitForEvent('download');
  await page.getByRole('link', {name:'Download',exact:true}).nth(index).click();
  return downloadBytes(await pending);
}
async function upload(page: Page, slug: string, widths = [200,300,400], options = {}) {
  await page.goto(`/${slug}`); await page.waitForLoadState('networkidle');
  await page.locator('input[type=file]').setInputFiles({ name: 'own #report.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await makePdf(widths,options)) });
  await page.getByRole('button', {name:'Read PDF pages'}).click();
}
async function finish(page: Page, action = 'Create PDF results') {
  await page.getByRole('button',{name:action}).click();
  await expect(page.getByRole('heading',{name:'Conversion Complete!'})).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as unknown as { pdfWorkers: Set<Worker> }).pdfWorkers.size)).toBe(0);
}
async function widthsOf(bytes: Buffer) {
  expect(bytes.subarray(0,5).toString()).toBe('%PDF-');
  return (await PDFDocument.load(bytes)).getPages().map(page=>page.getWidth());
}
async function streamsOf(bytes: Buffer) {
  const doc=await PDFDocument.load(bytes);
  return doc.getPages().map(page=>{
    const contents=page.node.Contents();
    const streams=contents instanceof PDFArray ? contents.asArray().map(ref=>doc.context.lookup(ref)) : [contents];
    return streams.filter((stream):stream is PDFRawStream=>stream instanceof PDFRawStream).map(stream=>new TextDecoder().decode(decodePDFRawStream(stream).decode())).join('\n');
  });
}
test.beforeEach(async ({page})=>{
  await page.addInitScript(()=>{
    const urls=new Set<string>(); const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);
    URL.createObjectURL=blob=>{const url=create(blob);urls.add(url);return url;};
    URL.revokeObjectURL=url=>{urls.delete(url);revoke(url);};
    Object.assign(window,{pdfResultUrls:urls});
    const workers = new Set<Worker>();
    const NativeWorker = Worker;
    window.Worker = class extends NativeWorker {
      constructor(url: string | URL, options?: WorkerOptions) { super(url, options); workers.add(this); }
      terminate() { workers.delete(this); super.terminate(); }
    };
    Object.assign(window, { pdfWorkers: workers });
  });
});

test('merge keeps uploader order, actual content, mixed sizes, privacy and cleanup',async({page})=>{
  await page.goto('/merge-pdf'); await page.waitForLoadState('networkidle');
  const network: string[]=[];page.on('request',request=>{if(request.postDataBuffer()?.length)network.push(request.url());});
  await page.locator('input[type=file]').setInputFiles([
    {name:'first.pdf',mimeType:'application/pdf',buffer:Buffer.from(await makePdf([200,300]))},
    {name:'second.pdf',mimeType:'application/pdf',buffer:Buffer.from(await makePdf([500]))},
  ]);
  await page.getByRole('button',{name:/Move second.pdf up/}).click();
  await page.getByRole('button',{name:'Read PDF pages'}).click(); await finish(page);
  const bytes=await result(page);expect(await widthsOf(bytes)).toEqual([500,200,300]);
  expect((await streamsOf(bytes))[0]).toContain('504147452031');
  expect(network).toEqual([]);
  await page.getByRole('button',{name:'Convert Another'}).click();
  expect(await page.evaluate(()=>(window as unknown as {pdfResultUrls:Set<string>}).pdfResultUrls.size)).toBe(0);
});

test('split creates valid custom groups and a ZIP with safe names',async({page})=>{
  await upload(page,'split-pdf');
  await page.getByLabel('Split method').selectOption('ranges');
  await page.getByLabel('Page groups').fill('3,1; 2'); await finish(page);
  expect(await widthsOf(await result(page))).toEqual([400,200]);
  expect(await widthsOf(await result(page,1))).toEqual([300]);
  const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Download All (ZIP)'}).click();
  const zip=await JSZip.loadAsync(await downloadBytes(await pending));
  expect(Object.keys(zip.files)).toEqual(['own__report-part-1.pdf','own__report-part-2.pdf']);
  expect(await widthsOf(await zip.files['own__report-part-1.pdf'].async('nodebuffer'))).toEqual([400,200]);
  await page.getByRole('button',{name:'Convert Another'}).click();
  expect(await page.evaluate(()=>(window as unknown as {pdfResultUrls:Set<string>}).pdfResultUrls.size)).toBe(0);
});

test('split one file per page uses real single-page PDFs',async({page})=>{
  await upload(page,'split-pdf');await finish(page);
  await expect(page.getByRole('link',{name:'Download',exact:true})).toHaveCount(3);
  for(let i=0;i<3;i++)expect(await widthsOf(await result(page,i))).toEqual([200+i*100]);
});

test('extract respects explicit page order and rejects invalid ranges',async({page})=>{
  await upload(page,'extract-pdf-pages');
  await page.getByLabel('Page range',{exact:true}).fill('0,99');await page.getByRole('button',{name:'Apply range'}).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('between 1 and 3');
  await page.getByLabel('Page range',{exact:true}).fill('3,1');await page.getByRole('button',{name:'Apply range'}).click();
  await finish(page);expect(await widthsOf(await result(page))).toEqual([400,200]);
});

test('delete removes selected pages and rejects removing every page',async({page})=>{
  await upload(page,'delete-pdf-pages');
  await page.getByLabel('Select page 2',{exact:true}).check();await finish(page);
  expect(await widthsOf(await result(page))).toEqual([200,400]);
  await upload(page,'delete-pdf-pages');await page.getByRole('button',{name:'Select all',exact:true}).click();
  await page.getByRole('button',{name:'Create PDF results'}).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Keep at least one page');
});

test('organize supports keyboard page movement and preserves every page',async({page})=>{
  await upload(page,'organize-pdf');
  const move=page.getByRole('button',{name:'Move page 3 up'});
  await move.focus();await page.keyboard.press('Enter');await page.keyboard.press('Enter');
  await expect(page.getByText('Position 1: Page 3',{exact:true})).toBeVisible();
  await finish(page);expect(await widthsOf(await result(page))).toEqual([400,200,300]);
});

test('rotation adds to existing angle on selected pages only',async({page})=>{
  await upload(page,'rotate-pdf',[200,300],{rotated:true});
  await page.getByRole('button',{name:'Clear selection'}).click();
  await page.getByLabel('Select page 2',{exact:true}).focus();await page.keyboard.press('Space');
  await page.getByLabel('Clockwise rotation').selectOption('270');await finish(page);
  const doc=await PDFDocument.load(await result(page));
  expect(doc.getPages().map(page=>page.getRotation().angle)).toEqual([90,0]);
});

test('page numbers and watermark write real text overlays, including rotated crop boxes',async({page})=>{
  await upload(page,'page-numbers-pdf',[200,300],{rotated:true,cropped:true});
  await page.getByLabel('Starting number').fill('7');await page.getByRole('combobox',{name:'Position',exact:true}).selectOption('top');await finish(page);
  const streams=await streamsOf(await result(page));expect(streams[0]).toContain('<37>');expect(streams[1]).toContain('<38>');
  await upload(page,'watermark-pdf',[200],{rotated:true,cropped:true});
  await page.getByLabel('Watermark text',{exact:true}).fill('REVIEW');await page.getByLabel('Watermark opacity').fill('40');await finish(page);
  expect((await streamsOf(await result(page)))[0]).toContain('<524556494557>');
});

for(const mode of ['jpg','png'] as const)test(`PDF to ${mode}: actual rendering, pixels, DPI, selected pages and no uploads`,async({page})=>{
  const requests: string[]=[];page.on('request',request=>{if(request.postDataBuffer()?.length||!new URL(request.url()).hostname.match(/^(localhost|127\.0\.0\.1)$/))requests.push(request.url());});
  await upload(page,`pdf-to-${mode}`,[200,300]);
  await page.getByRole('button',{name:'Clear selection'}).click();await page.getByLabel('Select page 2',{exact:true}).check();
  await page.getByLabel('Resolution').selectOption('144');if(mode==='jpg')await page.getByLabel('JPEG quality',{exact:true}).fill('70');
  await finish(page,`Export ${mode.toUpperCase()} pages`);
  const bytes=await result(page);
  if(mode==='png')expect([...bytes.subarray(0,8)]).toEqual([137,80,78,71,13,10,26,10]);else expect([...bytes.subarray(0,3)]).toEqual([255,216,255]);
  const image=await page.evaluate(async raw=>{const bitmap=await createImageBitmap(new Blob([new Uint8Array(raw)]));const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;const ctx=canvas.getContext('2d')!;ctx.drawImage(bitmap,0,0);const info={width:bitmap.width,height:bitmap.height,pixel:[...ctx.getImageData(5,5,1,1).data]};bitmap.close();canvas.width=0;canvas.height=0;return info;},[...bytes]);
  expect([image.width,image.height]).toEqual([600,480]);expect(image.pixel[2]).toBeGreaterThan(240);expect(image.pixel[0]).toBeLessThan(10);
  expect(requests).toEqual([]);await expect(page.getByRole('link',{name:'Download',exact:true})).toHaveAttribute('download',`own__report-page-2.${mode}`);
});

test('rendering refuses oversized pages before allocating canvas',async({page})=>{
  await upload(page,'pdf-to-png',[10000]);await page.getByRole('button',{name:'Export PNG pages'}).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Rendering exceeds');
  await expect(page.getByRole('link',{name:'Download',exact:true})).toHaveCount(0);
});

test('JPEG quality changes encoded bytes and 72 DPI produces expected pixel dimensions',async({page})=>{
  const sizes: number[]=[];
  for(const quality of [20,95]) {
    await upload(page,'pdf-to-jpg',[200],{complex:true});
    await page.getByLabel('Resolution').selectOption('72');
    await page.getByLabel('JPEG quality',{exact:true}).fill(String(quality));
    await finish(page,'Export JPG pages');const bytes=await result(page);sizes.push(bytes.length);
    expect(await page.evaluate(async raw=>{const bitmap=await createImageBitmap(new Blob([new Uint8Array(raw)]));const size=[bitmap.width,bitmap.height];bitmap.close();return size;},[...bytes])).toEqual([200,240]);
    await page.getByRole('button',{name:'Convert Another'}).click();
    expect(await page.evaluate(()=>(window as unknown as {pdfResultUrls:Set<string>}).pdfResultUrls.size)).toBe(0);
  }
  expect(sizes[1]).toBeGreaterThan(sizes[0]);
});

test('cancelling inspection terminates the worker and a new document can be processed',async({page})=>{
  await page.goto('/split-pdf');await page.waitForLoadState('networkidle');
  await page.evaluate(()=>{
    const original=Worker.prototype.postMessage;
    Worker.prototype.postMessage=function(message: unknown,options?: StructuredSerializeOptions | Transferable[]){
      if ((window as unknown as {holdPdfWorker?:boolean}).holdPdfWorker) return;
      original.call(this,message,Array.isArray(options) ? { transfer: options } : options);
    };
    Object.assign(window,{holdPdfWorker:true});
  });
  const source={name:'cancel.pdf',mimeType:'application/pdf',buffer:Buffer.from(await makePdf())};
  await page.locator('input[type=file]').setInputFiles(source);
  await page.getByRole('button',{name:'Read PDF pages'}).click();
  await expect.poll(()=>page.evaluate(()=>(window as unknown as {pdfWorkers:Set<Worker>}).pdfWorkers.size)).toBe(1);
  await page.getByRole('button',{name:'Cancel reading'}).click();
  await expect(page.getByRole('heading',{name:'Conversion Cancelled'})).toBeVisible();
  expect(await page.evaluate(()=>(window as unknown as {pdfWorkers:Set<Worker>}).pdfWorkers.size)).toBe(0);
  await page.evaluate(()=>Object.assign(window,{holdPdfWorker:false}));
  await page.getByRole('button',{name:'Start over'}).click();
  await page.locator('input[type=file]').setInputFiles(source);await page.getByRole('button',{name:'Read PDF pages'}).click();await finish(page);
});

for(const option of ['encrypted','form','script'] as const)test(`PDF ${option} files fail with useful errors and no downloads`,async({page})=>{
  await upload(page,'split-pdf',[200],{[option]:true});
  await expect(page.getByRole('main').getByRole('alert')).toContainText(/encrypt|password|forms|scripts/i);
  await expect(page.getByRole('link',{name:'Download',exact:true})).toHaveCount(0);
});

test('malformed and spoofed PDFs fail without a ready conversion',async({page})=>{
  await page.goto('/split-pdf');await page.waitForLoadState('networkidle');
  await page.locator('input[type=file]').setInputFiles({name:'spoof.pdf',mimeType:'application/pdf',buffer:Buffer.from('not a pdf')});
  await expect(page.getByRole('main').getByRole('alert')).toContainText('invalid files');
  await expect(page.getByRole('button',{name:'Read PDF pages'})).toHaveCount(0);
  await page.locator('input[type=file]').setInputFiles({name:'broken.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7\ninvalid\n%%EOF')});
  await page.getByRole('button',{name:'Read PDF pages'}).click();await expect(page.getByRole('main').getByRole('alert')).toContainText(/malformed/);
});

test('PDF upload responds to keyboard and page layouts fit mobile',async({page})=>{
  await page.goto('/extract-pdf-pages');await page.waitForLoadState('networkidle');
  const picker=page.waitForEvent('filechooser');
  const zone=page.getByRole('button',{name:'Choose PDF files or drop them here'});await zone.focus();await page.keyboard.press('Enter');
  await (await picker).setFiles({name:'keyboard.pdf',mimeType:'application/pdf',buffer:Buffer.from(await makePdf())});
  await page.getByRole('button',{name:'Read PDF pages'}).click();await expect(page.getByRole('list',{name:'PDF pages'})).toBeVisible();
  await page.setViewportSize({width:375,height:800});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
