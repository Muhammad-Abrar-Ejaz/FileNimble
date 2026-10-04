import { DocumentToolPage, documentMetadata } from '@/components/converter/document/DocumentToolPage';
export const metadata = documentMetadata('ocr-pdf');
export default function Page() { return <DocumentToolPage slug="ocr-pdf" />; }
