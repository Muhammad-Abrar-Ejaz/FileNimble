import { DocumentToolPage, documentMetadata } from '@/components/converter/document/DocumentToolPage';

export const metadata = documentMetadata('rtf-to-pdf');

export default function Page() {
  return <DocumentToolPage slug="rtf-to-pdf" />;
}
