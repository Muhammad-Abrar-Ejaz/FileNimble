import { DocumentToolPage, documentMetadata } from '@/components/converter/document/DocumentToolPage';

export const metadata = documentMetadata('markdown-to-docx');

export default function Page() {
  return <DocumentToolPage slug="markdown-to-docx" />;
}
