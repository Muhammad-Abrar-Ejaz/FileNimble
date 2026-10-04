import { PdfToolPage, pdfToolMetadata } from '@/components/converter/pdf/PdfToolPage';

export const metadata = pdfToolMetadata('delete-pdf-pages');

export default function Page() { return <PdfToolPage slug="delete-pdf-pages" />; }
