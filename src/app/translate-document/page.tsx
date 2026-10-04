import type { Metadata } from 'next';
import { AiToolPage } from '@/components/ai/AiToolPage';

export const metadata: Metadata = {
  title: 'Translate Document Text — FileNimble',
  description: 'Translate pasted text or selectable PDF text with an optional external AI provider.',
  robots: { index: false, follow: false },
};

export default function Page() { return <AiToolPage slug="translate-document" />; }
