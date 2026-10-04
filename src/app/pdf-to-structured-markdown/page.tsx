import type { Metadata } from 'next';
import { AiToolPage } from '@/components/ai/AiToolPage';

export const metadata: Metadata = {
  title: 'Convert PDF Text to Structured Markdown — FileNimble',
  description: 'Organize selectable PDF text as structured Markdown with an optional external AI provider.',
  robots: { index: false, follow: false },
};

export default function Page() { return <AiToolPage slug="pdf-to-structured-markdown" />; }
