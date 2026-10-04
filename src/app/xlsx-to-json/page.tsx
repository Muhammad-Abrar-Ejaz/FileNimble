import { DocumentToolPage, documentMetadata } from '@/components/converter/document/DocumentToolPage';

export const metadata = documentMetadata('xlsx-to-json');

export default function Page() {
  return <DocumentToolPage slug="xlsx-to-json" />;
}
