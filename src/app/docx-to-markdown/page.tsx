import { DocumentToolPage, documentMetadata } from '@/components/converter/document/DocumentToolPage';

export const metadata = documentMetadata('docx-to-markdown');

export default function Page() {
  return <DocumentToolPage slug="docx-to-markdown" />;
}
