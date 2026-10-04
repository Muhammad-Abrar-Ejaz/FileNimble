import { DocumentToolPage, documentMetadata } from '@/components/converter/document/DocumentToolPage';
export const metadata = documentMetadata('word-to-pdf');
export default function Page() { return <DocumentToolPage slug="word-to-pdf" />; }
