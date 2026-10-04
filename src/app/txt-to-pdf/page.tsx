import { DocumentToolPage, documentMetadata } from '@/components/converter/document/DocumentToolPage';

export const metadata = documentMetadata('txt-to-pdf');

export default function Page() {
  return <DocumentToolPage slug="txt-to-pdf" />;
}
