export type AiToolSlug = 'ai-document-summarizer' | 'translate-document' | 'pdf-to-structured-markdown';

export interface AiToolPageConfig {
  slug: AiToolSlug;
  title: string;
  description: string;
  action: string;
  outputName: string;
  acceptsPdf: boolean;
  pastedText: boolean;
  details: string;
  steps: string[];
}

export const AI_TOOLS: Record<AiToolSlug, AiToolPageConfig> = {
  'ai-document-summarizer': {
    slug: 'ai-document-summarizer', title: 'AI Document Summarizer',
    description: 'Create a concise AI-generated summary from pasted text or selectable PDF text.',
    action: 'Summarize text', outputName: 'document-summary.txt', acceptsPdf: true, pastedText: true,
    details: 'This summarizes text you paste or selectable text extracted locally from a PDF. Layout, images, scanned pages and tables may not be represented. Review the summary against the source.',
    steps: ['Paste text or select a PDF of up to 20 pages and 10 MiB.', 'Review the text extracted in this browser.', 'Accept the external AI processing disclosure, then request a summary.'],
  },
  'translate-document': {
    slug: 'translate-document', title: 'Translate Document Text',
    description: 'Translate pasted text or selectable PDF text with a configured AI provider.',
    action: 'Translate text', outputName: 'translated-document.txt', acceptsPdf: true, pastedText: true,
    details: 'Translation uses only pasted or selectable PDF text. Scanned images, complex layout, formatting, and embedded objects are not translated. Review names, figures and specialized terms.',
    steps: ['Paste text or select a PDF of up to 20 pages and 10 MiB.', 'Choose a target language and review extracted text.', 'Accept the external AI processing disclosure, then request a translation.'],
  },
  'pdf-to-structured-markdown': {
    slug: 'pdf-to-structured-markdown', title: 'Convert PDF Text to Structured Markdown',
    description: 'Use AI to organize selectable PDF text as structured Markdown.',
    action: 'Create Markdown', outputName: 'document.md', acceptsPdf: true, pastedText: false,
    details: 'This uses selectable PDF text only; it does not perform OCR or preserve exact page layout. Headings, lists and tables may be inferred incorrectly. Verify the Markdown against the original PDF.',
    steps: ['Select a PDF of up to 20 pages and 10 MiB.', 'Review the text extracted locally in this browser.', 'Accept the external AI processing disclosure, then create Markdown.'],
  },
};
