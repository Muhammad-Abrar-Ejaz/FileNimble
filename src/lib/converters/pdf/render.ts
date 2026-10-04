import { PDF_LIMITS, type PdfOutput } from './types';
import { validatePages } from './pages';
import { sanitizeFilename } from '@/lib/utils';

/** Only imported by PDF-to-image tools after structural validation in our worker. */
export async function renderPdfPages(file: File, pages: number[], format: 'jpg' | 'png', dpi: number, quality: number, signal: AbortSignal, progress?: (done: number, total: number) => void): Promise<PdfOutput[]> {
  if (![72, 144].includes(dpi) || !Number.isFinite(quality) || quality < 0.1 || quality > 1) throw new Error('Choose 72 or 144 DPI and quality between 10% and 100%.');
  if (!pages.length || pages.length > PDF_LIMITS.renderPages) throw new Error('Render between 1 and 40 pages at a time.');
  signal.throwIfAborted();
  const pdfjs = await import('pdfjs-dist');
  const assets = `/pdfjs/${pdfjs.version}/`;
  // Only program assets are fetched. PDF bytes are supplied locally, never by URL.
  pdfjs.GlobalWorkerOptions.workerSrc = `${assets}build/pdf.worker.min.mjs`;
  const data = new Uint8Array(await file.arrayBuffer());
  signal.throwIfAborted();
  const task = pdfjs.getDocument({ data, cMapUrl: `${assets}cmaps/`, cMapPacked: true, standardFontDataUrl: `${assets}standard_fonts/`, wasmUrl: `${assets}wasm/`, iccUrl: `${assets}iccs/`, enableXfa: false, stopAtErrors: true, useSystemFonts: false, verbosity: 0, canvasMaxAreaInBytes: PDF_LIMITS.pagePixels * 4 });
  const stop = () => { void task.destroy().catch(() => {}); };
  signal.addEventListener('abort', stop, { once: true });
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; stop(); }, 60_000);
  const outputs: PdfOutput[] = [];
  try {
    const doc = await task.promise;
    validatePages(pages, doc.numPages);
    let totalPixels = 0, outputBytes = 0;
    for (const index of pages) {
      signal.throwIfAborted();
      const page = await doc.getPage(index + 1);
      const viewport = page.getViewport({ scale: dpi / 72 });
      const width = Math.ceil(viewport.width), height = Math.ceil(viewport.height);
      totalPixels += width * height;
      if (![width, height].every(n => Number.isFinite(n) && n > 0 && n <= 8192) || width * height > PDF_LIMITS.pagePixels || totalPixels > PDF_LIMITS.totalPixels) throw new Error('Rendering exceeds 8 megapixels per page or 64 megapixels total. Choose 72 DPI or fewer pages.');
      const canvas = document.createElement('canvas');
      try {
        canvas.width = width; canvas.height = height;
        await page.render({ canvas, viewport, background: '#ffffff', annotationMode: pdfjs.AnnotationMode.DISABLE }).promise;
        signal.throwIfAborted();
        const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
        const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Unable to encode this page.')), mimeType, quality));
        if (blob.type !== mimeType) throw new Error('This browser does not support the requested image output.');
        outputBytes += blob.size;
        if (outputBytes > PDF_LIMITS.outputBytes) throw new Error('Images exceed 100 MiB. Choose fewer pages or a lower DPI.');
        const bytes = new Uint8Array(await blob.arrayBuffer());
        if (format === 'jpg' ? bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255 : bytes.slice(0, 8).join(',') !== '137,80,78,71,13,10,26,10') throw new Error('The output image signature is invalid.');
        const base = sanitizeFilename(file.name.replace(/\.pdf$/i, '')).slice(0, 150) || 'document';
        outputs.push({ name: `${base}-page-${index + 1}.${format}`, bytes, mimeType });
        progress?.(outputs.length, pages.length);
      } finally { canvas.width = 0; canvas.height = 0; page.cleanup(); }
    }
    signal.throwIfAborted();
    return outputs;
  } catch (error) {
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    if (timedOut) throw new Error('Rendering exceeded 60 seconds. Try fewer pages or a simpler PDF.');
    throw error instanceof Error ? error : new Error('This PDF could not be rendered.');
  } finally { clearTimeout(timer); signal.removeEventListener('abort', stop); await task.destroy().catch(() => {}); }
}
