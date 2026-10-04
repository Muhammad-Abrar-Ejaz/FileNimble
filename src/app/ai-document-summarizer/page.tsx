import type { Metadata } from 'next';
import { AiToolPage } from '@/components/ai/AiToolPage';

export const metadata: Metadata = {
  title: 'AI Document Summarizer — FileNimble',
  description: 'Summarize pasted text or selectable PDF text with an optional external AI provider.',
  robots: { index: false, follow: false },
};

export default function Page() { return <AiToolPage slug="ai-document-summarizer" />; }
