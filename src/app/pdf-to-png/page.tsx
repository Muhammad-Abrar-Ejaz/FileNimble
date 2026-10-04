import { PdfToolPage, pdfToolMetadata } from '@/components/converter/pdf/PdfToolPage';

export const metadata = pdfToolMetadata('pdf-to-png');

export default function Page() { return <PdfToolPage slug="pdf-to-png" />; }
