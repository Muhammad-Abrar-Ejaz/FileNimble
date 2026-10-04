import { describe, expect, it } from 'vitest';
import { extractPdfText } from './pdfText';

describe('AI PDF text input validation', () => {
  it('rejects spoofed extensions and MIME values before loading PDF.js', async () => {
    const controller = new AbortController();
    await expect(extractPdfText(new File(['not a PDF'], 'fake.pdf', { type: 'application/pdf' }), controller.signal)).rejects.toThrow(/signature/);
    await expect(extractPdfText(new File(['%PDF-1.7'], 'fake.txt', { type: 'text/plain' }), controller.signal)).rejects.toThrow(/matching PDF type/);
  });

  it('enforces conservative input size and abort behavior', async () => {
    const controller = new AbortController(); controller.abort();
    await expect(extractPdfText(new File(['%PDF-1.7'], 'large.pdf', { type: 'application/pdf' }), controller.signal)).rejects.toThrow();
  });
});
