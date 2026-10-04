import { DocumentToolPage, documentMetadata } from '@/components/converter/document/DocumentToolPage';

export const metadata = documentMetadata('json-to-xlsx');

export default function Page() {
  return <DocumentToolPage slug="json-to-xlsx" />;
}
