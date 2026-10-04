import { PdfToolPage, pdfToolMetadata } from '@/components/converter/pdf/PdfToolPage';

export const metadata = pdfToolMetadata('page-numbers-pdf');

export default function Page() { return <PdfToolPage slug="page-numbers-pdf" />; }
