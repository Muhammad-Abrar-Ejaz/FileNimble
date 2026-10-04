import { PdfToolPage, pdfToolMetadata } from '@/components/converter/pdf/PdfToolPage';

export const metadata = pdfToolMetadata('rotate-pdf');

export default function Page() { return <PdfToolPage slug="rotate-pdf" />; }
