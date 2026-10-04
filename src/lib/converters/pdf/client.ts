import { PDF_LIMITS, type PdfRequest, type PdfResponse } from './types';

/** A fresh, terminable worker owns PDF documents/byte arrays for each operation. */
export function runPdfWorker(request: PdfRequest, signal: AbortSignal): Promise<Extract<PdfResponse, { ok: true }>> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('Cancelled', 'AbortError')); return; }
    const worker = new Worker(new URL('./pdf.worker.ts', import.meta.url), { type: 'module' });
    const cleanup = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); worker.terminate(); };
    const abort = () => { cleanup(); reject(new DOMException('Cancelled', 'AbortError')); };
    const timer = setTimeout(() => { cleanup(); reject(new Error('PDF processing exceeded 30 seconds. Try a smaller or simpler document.')); }, PDF_LIMITS.workerMs);
    signal.addEventListener('abort', abort, { once: true });
    worker.onmessage = ({ data }: MessageEvent<PdfResponse>) => { cleanup(); if (data.ok) resolve(data); else reject(new Error(data.error)); };
    worker.onerror = () => { cleanup(); reject(new Error('The PDF worker could not run. Reload the page or try a smaller PDF in a current browser.')); };
    try { worker.postMessage(request); } catch { cleanup(); reject(new Error('Could not send the PDF to the local worker. Reload and select it again.')); }
  });
}
