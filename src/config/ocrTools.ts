import type { DocumentTool } from './documentTools';

const shared = 'English printed text only. Maximum 10 MiB, five PDF pages, four megapixels per rendered page and sixteen megapixels total. Encrypted, malformed and active-content PDFs are rejected. Handwriting, unusual layouts and poor scans can produce missing or incorrect words. Review the result; no accuracy percentage is promised.';

export const OCR_TOOLS: DocumentTool[] = [
  {
    slug: 'image-to-text', title: 'Extract English Text from an Image', extension: 'png', inputExtensions: ['png', 'jpg', 'jpeg'], output: 'txt', ocr: true,
    description: 'Planned image-to-text OCR tool; currently unavailable. No image is uploaded or processed.',
    explanation: 'The isolated OCR worker checks the image content, recognizes printed words and returns a UTF-8 text file. Selecting an image does not upload it; processing starts only after you choose Upload and convert.',
    limitations: 'One PNG or JPEG, at most four megapixels and 6000 pixels per side. Animated and multipage images are unsupported. Text output does not preserve fonts or layout. Blank images produce an empty text result. ' + shared,
    steps: ['Select a clear PNG or JPEG scan.', 'Choose English and whether to apply deskew/cleanup, then upload explicitly.', 'Download the text and check it against your image.'],
    faqs: [{ q: 'Can this read handwriting?', a: 'Handwriting is not supported reliably. Use clear printed English text and check names, numbers and punctuation.' }, { q: 'What does cleanup do?', a: 'It applies grayscale contrast adjustment, light noise filtering, orientation detection and small-angle deskew. You can turn it off; cleanup can alter fine details.' }],
  },
  {
    slug: 'pdf-to-text', title: 'Extract English Text from Scanned PDF', extension: 'pdf', output: 'txt', ocr: true,
    description: 'Planned PDF text OCR tool; currently unavailable. No PDF is uploaded or processed.',
    explanation: 'Each page is rendered locally inside the server worker at 144 DPI and recognized by Tesseract. The text file separates pages with form-feed markers. This also works on supported PDFs that already contain text, but OCR can introduce errors.',
    limitations: 'Columns, reading order, tables and punctuation may not be reconstructed correctly. Blank pages contribute no recognized words. Original formatting is not retained. ' + shared,
    steps: ['Select a supported PDF of up to five pages.', 'Choose English and optional cleanup, then upload for OCR.', 'Download the UTF-8 text and review page order and recognition errors.'],
    faqs: [{ q: 'Will tables become spreadsheets?', a: 'No. OCR returns plain text, not reconstructed cells or formulas.' }, { q: 'Does it bypass PDF passwords?', a: 'No. Password-protected PDFs are rejected; no password guessing or bypass is attempted.' }],
  },
  {
    slug: 'ocr-pdf', title: 'Make a Scanned PDF Searchable', extension: 'pdf', output: 'pdf', ocr: true,
    description: 'Planned searchable-PDF OCR tool; currently unavailable. No PDF is uploaded or processed.',
    explanation: 'Pages are rendered at 144 DPI in source order. Tesseract produces page images with an invisible recognized-text layer, and the worker validates the combined PDF and page count before download.',
    limitations: 'This is a rasterized OCR copy: original vector content, bookmarks and document structure are not retained. Cleanup can change contrast, orientation and edges; turn it off to reduce visual changes. Text-layer alignment and recognition are imperfect. This is not PDF/A certification or accessible-PDF tagging. ' + shared,
    steps: ['Select a scanned PDF with up to five pages.', 'Choose English; turn cleanup off if preserving the scan appearance is more important.', 'Download the searchable PDF and check its pages, search results and copied text.'],
    faqs: [{ q: 'Will the page count and order be preserved?', a: 'The worker checks that the output has the same number of pages and processes them in source order. Rendering and optional cleanup may change visual details.' }, { q: 'Is every recognized word aligned perfectly?', a: 'No. OCR text and its placement can be inaccurate, especially with skew, noise, small text and complex layouts.' }],
  },
];
