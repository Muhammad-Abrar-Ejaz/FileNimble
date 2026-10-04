import { PdfToolPage, pdfToolMetadata } from '@/components/converter/pdf/PdfToolPage';

export const metadata = pdfToolMetadata('split-pdf');

export default function Page() { return <PdfToolPage slug="split-pdf" />; }
