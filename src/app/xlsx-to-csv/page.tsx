import { DocumentToolPage, documentMetadata } from '@/components/converter/document/DocumentToolPage';

export const metadata = documentMetadata('xlsx-to-csv');

export default function Page() {
  return <DocumentToolPage slug="xlsx-to-csv" />;
}
