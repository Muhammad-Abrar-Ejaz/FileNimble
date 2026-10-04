import { DocumentToolPage, documentMetadata } from '@/components/converter/document/DocumentToolPage';
export const metadata = documentMetadata('html-to-pdf');
export default function Page() { return <DocumentToolPage slug="html-to-pdf" />; }
