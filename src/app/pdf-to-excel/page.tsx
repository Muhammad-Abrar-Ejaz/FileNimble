import { DocumentToolPage, documentMetadata } from '@/components/converter/document/DocumentToolPage';
export const metadata = documentMetadata('pdf-to-excel');
export default function Page() { return <DocumentToolPage slug="pdf-to-excel" />; }
