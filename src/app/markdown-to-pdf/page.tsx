import { DocumentToolPage, documentMetadata } from '@/components/converter/document/DocumentToolPage';

export const metadata = documentMetadata('markdown-to-pdf');

export default function Page() {
  return <DocumentToolPage slug="markdown-to-pdf" />;
}
