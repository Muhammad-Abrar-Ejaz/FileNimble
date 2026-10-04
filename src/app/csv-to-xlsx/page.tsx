import { DocumentToolPage, documentMetadata } from '@/components/converter/document/DocumentToolPage';

export const metadata = documentMetadata('csv-to-xlsx');

export default function Page() {
  return <DocumentToolPage slug="csv-to-xlsx" />;
}
