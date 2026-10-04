import { describe, it, expect } from 'vitest';
import { PDFDocument, PDFArray, PDFRawStream, PDFName, decodePDFRawStream } from 'pdf-lib';
import { makePdf } from './fixtures';
import { convertPdfs, inspectPdfs, loadPdf, pdfFilename, validatePdfBatch } from './engine';
import { parsePages } from './pages';
import { PDF_LIMITS, type PdfOperation } from './types';

const file = async (widths = [200,300,400], options = {}) => new File([await makePdf(widths, options)], 'own fixture.pdf', { type: 'application/pdf' });
async function content(bytes: Uint8Array) {
  const doc = await PDFDocument.load(bytes);
  return doc.getPages().map(page => {
    const contents = page.node.Contents();
    const streams = contents instanceof PDFArray ? contents.asArray().map(ref => doc.context.lookup(ref)) : [contents];
    return streams.filter((value): value is PDFRawStream => value instanceof PDFRawStream).map(stream => new TextDecoder().decode(decodePDFRawStream(stream).decode())).join('\n');
  });
}
describe('PDF structure, security and limits', () => {
  it('reads actual page counts, mixed sizes, rotation and blank MIME', async () => {
    const source = new File([await makePdf([200,400],{rotated:true})], 'source.pdf');
    expect((await inspectPdfs([source]))[0].pages).toEqual([{width:200,height:240,rotation:90},{width:400,height:240,rotation:90}]);
  });
  for (const name of ['../file.pdf','file.png']) it(`rejects filename ${name}`, () => expect(() => validatePdfBatch([new File(['%PDF-'],name)])).toThrow());
  it('rejects spoofed content despite PDF extension and MIME', async () => { await expect(loadPdf(new File(['plain text %%EOF'],'spoof.pdf',{type:'application/pdf'}))).rejects.toThrow(/header/); });
  it('rejects incompatible MIME', async () => { await expect(loadPdf(new File([await makePdf()], 'file.pdf', {type:'image/png'}))).rejects.toThrow(/MIME/); });
  it('rejects empty/truncated/malformed PDFs', async () => {
    await expect(loadPdf(new File([], 'empty.pdf'))).rejects.toThrow(/non-empty/);
    await expect(loadPdf(new File(['%PDF-1.7 damaged'], 'cut.pdf'))).rejects.toThrow(/truncated/);
    await expect(loadPdf(new File(['%PDF-1.7\ninvalid\n%%EOF'], 'broken.pdf'))).rejects.toThrow(/malformed/);
  });
  for (const option of ['encrypted','form','script'] as const) it(`rejects ${option} PDFs without bypass`, async () => {
    await expect(loadPdf(await file([200],{[option]:true}))).rejects.toThrow(/encrypt|password|forms|scripts/i);
  });
  it('enforces bytes, file count, individual and aggregate page limits', async () => {
    const source = await file();
    expect(() => validatePdfBatch(Array(11).fill(source))).toThrow(/10/);
    const oversized = new File(['a'], 'big.pdf'); Object.defineProperty(oversized,'size',{value:PDF_LIMITS.fileBytes+1});
    expect(() => validatePdfBatch([oversized])).toThrow(/25 MiB/);
    const sized = new File(['a'], 'limit.pdf'); Object.defineProperty(sized,'size',{value:PDF_LIMITS.fileBytes});
    expect(() => validatePdfBatch([sized,sized,sized])).toThrow(/50 MiB/);
    await expect(loadPdf(await file(Array(201).fill(200)))).rejects.toThrow(/200/);
    await expect(inspectPdfs([await file(Array(101).fill(200)),await file(Array(100).fill(200))])).rejects.toThrow(/total/);
    await expect(loadPdf(await file([20000]))).rejects.toThrow(/dimensions/);
  });
  it('rejects huge embedded image dimensions and nested automatic actions', async () => {
    const doc=await PDFDocument.load(await makePdf([200]));
    const image=doc.context.flateStream(new Uint8Array([0]),{Type:'XObject',Subtype:'Image',Width:10000,Height:10000,BitsPerComponent:8,ColorSpace:'DeviceRGB'});
    doc.context.register(image);
    await expect(loadPdf(new File([new Uint8Array(await doc.save())],'huge-image.pdf'))).rejects.toThrow(/embedded image/);
    const active=await PDFDocument.load(await makePdf([200]));
    active.catalog.set(PDFName.of('OpenAction'),active.context.obj({S:'JavaScript',JS:'app.alert(1)'}));
    await expect(loadPdf(new File([new Uint8Array(await active.save())],'action.pdf'))).rejects.toThrow(/automatic actions/);
  });
});
describe('PDF page operations', () => {
  it('merges in file and page order without resizing content', async () => {
    const outputs=await convertPdfs([await file([200,300]),await file([500])],{operation:'merge'});
    const doc=await PDFDocument.load(outputs[0].bytes);
    expect(doc.getPages().map(page=>page.getWidth())).toEqual([200,300,500]);
    expect(await content(outputs[0].bytes)).toEqual(expect.arrayContaining([expect.stringContaining('504147452031')]));
    expect(new TextDecoder().decode(outputs[0].bytes.slice(0,5))).toBe('%PDF-');
    expect(outputs[0].mimeType).toBe('application/pdf');
  });
  for(const [operation,pages,expected] of [['extract',[2,0],[400,200]],['delete',[1],[200,400]],['organize',[2,1,0],[400,300,200]]] as const) {
    it(`${operation} uses exact requested pages/order`,async()=>{
      const outputs=await convertPdfs([await file()],{operation,pages:[...pages]});
      expect((await PDFDocument.load(outputs[0].bytes)).getPages().map(page=>page.getWidth())).toEqual(expected);
    });
  }
  it('splits all pages and custom groups into valid PDFs',async()=>{
    const source=await file();
    const each=await convertPdfs([source],{operation:'split'});
    expect(each.map(result=>result.name)).toEqual(['own_fixture-part-1.pdf','own_fixture-part-2.pdf','own_fixture-part-3.pdf']);
    for(const result of each)expect((await PDFDocument.load(result.bytes)).getPageCount()).toBe(1);
    const groups=await convertPdfs([source],{operation:'split',groups:[[2,0],[1]]});
    expect((await PDFDocument.load(groups[0].bytes)).getPages().map(page=>page.getWidth())).toEqual([400,200]);
    expect(groups).toHaveLength(2);
  });
  it('rotates only selected pages relative to existing rotation',async()=>{
    const result=await convertPdfs([await file([200,300],{rotated:true})],{operation:'rotate',pages:[1],angle:270});
    expect((await PDFDocument.load(result[0].bytes)).getPages().map(page=>page.getRotation().angle)).toEqual([90,0]);
  });
  it('writes page numbers and text watermark into actual page streams',async()=>{
    const source=await file([200,300],{rotated:true,cropped:true});
    const numbered=await convertPdfs([source],{operation:'numbers',startNumber:7,position:'top'});
    const streams=await content(numbered[0].bytes);
    expect(streams[0]).toContain('<37>'); expect(streams[1]).toContain('<38>');
    expect(streams[0]).toContain('Tf');
    const marked=await convertPdfs([source],{operation:'watermark',text:'DRAFT',opacity:0.4});
    expect((await content(marked[0].bytes))[0]).toContain('<4452414654>');
  });
  it('rejects impossible selections and invalid stamping options',async()=>{
    const source=await file();
    for(const operation of ['extract','delete','organize'] as PdfOperation[])await expect(convertPdfs([source],{operation,pages:[10]})).rejects.toThrow();
    await expect(convertPdfs([source],{operation:'delete',pages:[0,1,2]})).rejects.toThrow(/Keep at least/);
    await expect(convertPdfs([source],{operation:'organize',pages:[1]})).rejects.toThrow(/every page/);
    await expect(convertPdfs([source],{operation:'rotate',angle:45})).rejects.toThrow(/rotation/);
    await expect(convertPdfs([source],{operation:'numbers',startNumber:NaN})).rejects.toThrow(/starting/);
    await expect(convertPdfs([source],{operation:'watermark',text:'漢字'})).rejects.toThrow(/printable/);
    await expect(convertPdfs([source],{operation:'watermark',text:'DRAFT',opacity:2})).rejects.toThrow(/Opacity/);
    await expect(convertPdfs([source],{operation:'split',groups:Array(101).fill([0])})).rejects.toThrow(/100/);
    await expect(convertPdfs([source],{operation:'merge'})).rejects.toThrow(/at least two/);
  });
  it('produces safe predictable output filenames',()=>expect(pdfFilename('my <report>.pdf','extract')).toBe('my__report_-extract.pdf'));
});
describe('page ranges',()=>{
  it('preserves range order',()=>expect(parsePages('5, 1-3',5)).toEqual([4,0,1,2]));
  for(const text of ['', '0','6','3-1','1,1','1-3,2','1.5','1-999999999','x','1,'])it(`rejects invalid range ${text}`,()=>expect(()=>parsePages(text,5)).toThrow());
});
