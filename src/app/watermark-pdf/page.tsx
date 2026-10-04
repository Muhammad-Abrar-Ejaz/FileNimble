import { PdfToolPage, pdfToolMetadata } from '@/components/converter/pdf/PdfToolPage';

export const metadata = pdfToolMetadata('watermark-pdf');

export default function Page() { return <PdfToolPage slug="watermark-pdf" />; }
