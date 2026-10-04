import { PdfToolPage, pdfToolMetadata } from '@/components/converter/pdf/PdfToolPage';

export const metadata = pdfToolMetadata('merge-pdf');

export default function Page() { return <PdfToolPage slug="merge-pdf" />; }
