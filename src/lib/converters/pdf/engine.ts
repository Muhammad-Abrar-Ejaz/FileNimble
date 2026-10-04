import { PDFDocument, PDFDict, PDFArray, PDFName, PDFNumber, PDFRawStream, StandardFonts, degrees, rgb, type PDFPage, type PDFObject } from 'pdf-lib';
import { isFilenameSafe } from '@/lib/validation';
import { sanitizeFilename } from '@/lib/utils';
import { PDF_LIMITS, type PdfInfo, type PdfOptions, type PdfOutput } from './types';
import { validatePages } from './pages';

export function validatePdfBatch(files: File[]): void {
  if (!files.length || files.length > PDF_LIMITS.files) throw new Error('Choose between 1 and 10 PDFs.');
  if (files.reduce((sum, file) => sum + file.size, 0) > PDF_LIMITS.batchBytes) throw new Error('The PDF batch must be 50 MiB or smaller.');
  for (const file of files) {
    if (!isFilenameSafe(file.name) || !/\.pdf$/i.test(file.name)) throw new Error('Choose a PDF with a safe .pdf filename.');
    if (file.type && file.type !== 'application/pdf') throw new Error('The file MIME type must be application/pdf or unspecified.');
    if (!file.size || file.size > PDF_LIMITS.fileBytes) throw new Error('Each PDF must be non-empty and at most 25 MiB.');
  }
}

export async function loadPdf(file: File): Promise<PDFDocument> {
  validatePdfBatch([file]);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder().decode(bytes.subarray(0, 5)) !== '%PDF-') throw new Error('The file does not have a valid %PDF- header.');
  if (!new TextDecoder().decode(bytes.subarray(-1024)).includes('%%EOF')) throw new Error('The PDF is truncated or missing its end marker.');
  let doc: PDFDocument;
  try {
    // Never ignore encryption, supply passwords, or attempt decryption.
    doc = await PDFDocument.load(bytes, { updateMetadata: false, throwOnInvalidObject: true });
  } catch (error) {
    if (error instanceof Error && /encrypt|password/i.test(error.message)) throw new Error('Encrypted or password-protected PDFs are not supported. Export an unencrypted copy using an authorized application.');
    throw new Error('This PDF is malformed or unsupported. Try exporting a fresh PDF from its original application.');
  }
  if (doc.isEncrypted) throw new Error('Encrypted PDFs are not supported.');
  let pages: PDFPage[];
  try { pages = doc.getPages(); } catch { throw new Error('This PDF has a malformed page tree. Export a fresh PDF from the original application.'); }
  const count = pages.length;
  if (count < 1 || count > PDF_LIMITS.pages) throw new Error('PDFs must contain 1–200 pages.');
  if (doc.catalog.has(PDFName.of('AcroForm')) || doc.catalog.has(PDFName.of('Collection'))) throw new Error('Interactive forms, signed PDFs and PDF portfolios are not supported. Export a plain PDF first.');
  const objects = doc.context.enumerateIndirectObjects();
  if (objects.length > 50000) throw new Error('This PDF has too many internal objects. Export a simpler document.');
  const pending = objects.map(([, object]) => object);
  const visited = new Set<PDFObject>();
  while (pending.length) {
    const value = pending.pop()!;
    if (visited.has(value)) continue;
    visited.add(value);
    if (visited.size > 150000) throw new Error('This PDF is too complex for browser processing.');
    const object = value instanceof PDFRawStream ? value.dict : value;
    if (object instanceof PDFArray) pending.push(...object.asArray());
    if (!(object instanceof PDFDict)) continue;
    for (const [, child] of object.entries()) pending.push(child);
    if (object.get(PDFName.of('Subtype'))?.toString() === '/Image') {
      const width = object.lookupMaybe(PDFName.of('Width'), PDFNumber)?.asNumber() ?? 0;
      const height = object.lookupMaybe(PDFName.of('Height'), PDFNumber)?.asNumber() ?? 0;
      if (![width, height].every(n => Number.isFinite(n) && n > 0 && n <= 16384) || width * height > 24_000_000) throw new Error('An embedded image exceeds 24 megapixels or 16,384 pixels per side. Use a smaller source image.');
    }
    if (object.has(PDFName.of('JS')) || object.has(PDFName.of('AA')) || object.has(PDFName.of('OpenAction')) ||
      ['/JavaScript', '/Launch', '/SubmitForm', '/ImportData', '/GoToR'].includes(object.get(PDFName.of('S'))?.toString() || '') ||
      ['/EmbeddedFile', '/Filespec', '/Sig'].includes(object.get(PDFName.of('Type'))?.toString() || '')) {
      throw new Error('PDFs with scripts, embedded files, signatures or automatic actions are unsupported. Export a plain PDF first.');
    }
  }
  for (const page of pages) {
    const { width, height } = page.getSize();
    const crop = page.getCropBox();
    if (![width, height, crop.width, crop.height].every(value => Number.isFinite(value) && value > 0 && value <= 14400) || ![crop.x, crop.y].every(Number.isFinite) || page.getRotation().angle % 90 !== 0) throw new Error('Unsupported PDF page dimensions or rotation.');
  }
  return doc;
}

export async function inspectPdfs(files: File[]): Promise<PdfInfo[]> {
  validatePdfBatch(files);
  const info: PdfInfo[] = [];
  let total = 0;
  for (const file of files) {
    const doc = await loadPdf(file);
    total += doc.getPageCount();
    if (total > PDF_LIMITS.pages) throw new Error('A batch may contain at most 200 pages in total.');
    info.push({ name: file.name, pages: doc.getPages().map(page => ({ ...page.getSize(), rotation: page.getRotation().angle })) });
  }
  return info;
}

export function pdfFilename(name: string, suffix: string, extension = 'pdf'): string {
  const base = sanitizeFilename(name.replace(/\.pdf$/i, '')).slice(0, 150) || 'document';
  return `${base}-${suffix}.${extension}`;
}

function visualPoint(page: PDFPage, x: number, y: number) {
  const box = page.getCropBox();
  const angle = ((page.getRotation().angle % 360) + 360) % 360;
  if (angle === 90) return { x: box.x + box.width - y, y: box.y + x, rotate: degrees(90) };
  if (angle === 180) return { x: box.x + box.width - x, y: box.y + box.height - y, rotate: degrees(180) };
  if (angle === 270) return { x: box.x + y, y: box.y + box.height - x, rotate: degrees(270) };
  return { x: box.x + x, y: box.y + y, rotate: degrees(0) };
}

async function stamp(doc: PDFDocument, options: PdfOptions) {
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const start = options.startNumber ?? 1;
  if (!Number.isInteger(start) || start < 1 || start > 99999) throw new Error('The starting number must be between 1 and 99,999.');
  const text = options.text?.trim() || '';
  if (options.operation === 'watermark' && (!/^[\x20-\x7e]{1,80}$/.test(text))) throw new Error('Watermark text must contain 1–80 printable English letters, numbers or punctuation.');
  const opacity = options.opacity ?? 0.25;
  if (!Number.isFinite(opacity) || opacity < 0.1 || opacity > 1) throw new Error('Opacity must be between 10% and 100%.');
  for (const [index, page] of doc.getPages().entries()) {
    const box = page.getCropBox(), sideways = Math.abs(page.getRotation().angle % 180) === 90;
    const width = sideways ? box.height : box.width, height = sideways ? box.width : box.height;
    if (width < 72 || height < 72) throw new Error('Pages must be at least 72 points wide and high for text overlays.');
    const label = options.operation === 'numbers' ? String(start + index) : text;
    const size = Math.min(options.operation === 'numbers' ? 12 : 40, (width - 32) / font.widthOfTextAtSize(label, 1), height / 5);
    const x = (width - font.widthOfTextAtSize(label, size)) / 2;
    const y = options.operation === 'numbers' ? (options.position === 'top' ? height - 24 : 16) : (height - size) / 2;
    page.drawText(label, { ...visualPoint(page, x, y), font, size, color: rgb(0.25, 0.25, 0.25), opacity: options.operation === 'numbers' ? 1 : opacity });
  }
}

export async function convertPdfs(files: File[], options: PdfOptions): Promise<PdfOutput[]> {
  validatePdfBatch(files);
  if (options.operation !== 'merge' && files.length !== 1) throw new Error('This tool accepts one PDF at a time.');
  if (options.operation === 'merge' && files.length < 2) throw new Error('Select at least two PDFs to merge.');
  const outputs: PdfOutput[] = [];
  let outputBytes = 0;
  const save = async (doc: PDFDocument, name: string) => {
    const bytes = new Uint8Array(await doc.save());
    outputBytes += bytes.byteLength;
    if (outputBytes > PDF_LIMITS.outputBytes || outputs.length >= PDF_LIMITS.outputs) throw new Error('Output exceeds 100 MiB or 100 files. Choose fewer pages.');
    const verified = await PDFDocument.load(bytes, { updateMetadata: false, throwOnInvalidObject: true });
    if (verified.getPageCount() !== doc.getPageCount() || new TextDecoder().decode(bytes.subarray(0, 5)) !== '%PDF-') throw new Error('Could not verify the output PDF.');
    outputs.push({ name, bytes, mimeType: 'application/pdf' });
  };
  if (options.operation === 'merge') {
    const target = await PDFDocument.create();
    for (const file of files) {
      const source = await loadPdf(file);
      if (target.getPageCount() + source.getPageCount() > PDF_LIMITS.pages) throw new Error('Merged PDFs may contain at most 200 pages.');
      for (const page of await target.copyPages(source, source.getPageIndices())) target.addPage(page);
    }
    await save(target, 'merged-document.pdf');
    return outputs;
  }
  const source = await loadPdf(files[0]);
  const count = source.getPageCount(), all = source.getPageIndices();
  let selected = validatePages(options.pages ?? all, count);
  if (options.operation === 'delete') {
    selected = all.filter(index => !selected.includes(index));
    if (!selected.length) throw new Error('Keep at least one page in the PDF.');
  }
  if (options.operation === 'organize' && selected.length !== count) throw new Error('Reordering must include every page exactly once. Use Extract or Delete to remove pages.');
  const groups = options.operation === 'split' ? options.groups ?? all.map(index => [index]) : [options.operation === 'rotate' || options.operation === 'numbers' || options.operation === 'watermark' ? all : selected];
  if (!groups.length || groups.length > PDF_LIMITS.outputs || groups.reduce((n, group) => n + group.length, 0) > PDF_LIMITS.pages) throw new Error('Split output is limited to 100 files and 200 total pages.');
  for (const [index, group] of groups.entries()) {
    validatePages(group, count);
    const target = await PDFDocument.create();
    for (const page of await target.copyPages(source, group)) target.addPage(page);
    if (options.operation === 'rotate') {
      if (![90, 180, 270].includes(options.angle ?? 90)) throw new Error('Choose a rotation of 90, 180 or 270 degrees.');
      selected.forEach(page => target.getPage(page).setRotation(degrees((target.getPage(page).getRotation().angle + (options.angle ?? 90)) % 360)));
    }
    if (options.operation === 'numbers' || options.operation === 'watermark') await stamp(target, options);
    await save(target, pdfFilename(files[0].name, options.operation === 'split' ? `part-${index + 1}` : options.operation));
  }
  return outputs;
}
