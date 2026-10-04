export const AI_TEXT_LIMITS = { pdfBytes: 10 * 1024 * 1024, pages: 20, characters: 12_000, timeoutMs: 20_000 } as const;

/** Extract bounded selectable text locally; only the returned text may be sent after consent. */
export async function extractPdfText(file: File, signal: AbortSignal): Promise<{ text: string; pages: number }> {
  if (!file.name.toLowerCase().endsWith('.pdf') || (file.type && file.type !== 'application/pdf')) {
    throw new Error('Choose a PDF file with a matching PDF type.');
  }
  if (file.size < 8 || file.size > AI_TEXT_LIMITS.pdfBytes) throw new Error('PDF files must be 10 MiB or smaller.');
  const bytes = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
  const header = new TextDecoder('latin1').decode(bytes);
  if (!header.startsWith('%PDF-')) throw new Error('The selected file does not contain a PDF signature.');
  signal.throwIfAborted();
  const pdfjs = await import('pdfjs-dist');
  const assets = `/pdfjs/${pdfjs.version}/`;
  pdfjs.GlobalWorkerOptions.workerSrc = `${assets}build/pdf.worker.min.mjs`;
  const data = new Uint8Array(await file.arrayBuffer());
  signal.throwIfAborted();
  const loading = pdfjs.getDocument({
    data,
    cMapUrl: `${assets}cmaps/`, cMapPacked: true,
    standardFontDataUrl: `${assets}standard_fonts/`, wasmUrl: `${assets}wasm/`, iccUrl: `${assets}iccs/`,
    enableXfa: false, stopAtErrors: true, useSystemFonts: false, verbosity: 0,
  });
  const stop = () => { void loading.destroy().catch(() => {}); };
  signal.addEventListener('abort', stop, { once: true });
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; stop(); }, AI_TEXT_LIMITS.timeoutMs);
  try {
    const document = await loading.promise;
    if (document.numPages < 1 || document.numPages > AI_TEXT_LIMITS.pages) throw new Error('This tool supports PDFs with up to 20 pages.');
    const text: string[] = [];
    let characters = 0;
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      signal.throwIfAborted();
      const page = await document.getPage(pageNumber);
      try {
        const content = await page.getTextContent();
        const line = content.items.map(item => 'str' in item ? item.str : '').join(' ').trim();
        characters += line.length + 1;
        if (characters > AI_TEXT_LIMITS.characters) throw new Error('Extracted text exceeds the 12,000-character limit. Select a shorter document.');
        text.push(line);
      } finally { page.cleanup(); }
    }
    const output = text.join('\n').trim();
    if (!output) throw new Error('No selectable text was found. Scanned PDFs need OCR before using these AI tools.');
    return { text: output, pages: document.numPages };
  } catch (error) {
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    if (timedOut) throw new Error('PDF text extraction took too long. Try a smaller document.');
    throw error instanceof Error ? error : new Error('This PDF could not be read.');
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', stop);
    await loading.destroy().catch(() => {});
    try { if (data.byteLength) data.fill(0); } catch { /* PDF.js may have transferred and detached this buffer. */ }
  }
}
