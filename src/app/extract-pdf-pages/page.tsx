import { PdfToolPage, pdfToolMetadata } from '@/components/converter/pdf/PdfToolPage';

export const metadata = pdfToolMetadata('extract-pdf-pages');

export default function Page() { return <PdfToolPage slug="extract-pdf-pages" />; }
