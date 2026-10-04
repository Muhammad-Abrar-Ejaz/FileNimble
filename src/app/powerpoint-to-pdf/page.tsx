import { DocumentToolPage, documentMetadata } from '@/components/converter/document/DocumentToolPage';
export const metadata = documentMetadata('powerpoint-to-pdf');
export default function Page() { return <DocumentToolPage slug="powerpoint-to-pdf" />; }
