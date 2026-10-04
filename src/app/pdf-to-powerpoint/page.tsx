import { DocumentToolPage, documentMetadata } from '@/components/converter/document/DocumentToolPage';
export const metadata = documentMetadata('pdf-to-powerpoint');
export default function Page() { return <DocumentToolPage slug="pdf-to-powerpoint" />; }
