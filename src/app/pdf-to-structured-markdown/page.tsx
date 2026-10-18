import type { Metadata } from 'next';
import { AiToolPage } from '@/components/ai/AiToolPage';

export const metadata: Metadata = {
  title: 'Convert PDF Text to Structured Markdown — FileNimble',
  description: 'AI processing is disabled in this release. This experimental tool is unavailable for now.',
  robots: { index: false, follow: false },
};

export default function Page() { return <AiToolPage slug="pdf-to-structured-markdown" />; }
