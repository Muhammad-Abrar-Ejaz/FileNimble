import { DataToolPage, dataToolMetadata } from '@/components/converter/data/DataToolPage';

export const metadata = dataToolMetadata('html-to-markdown');

export default function Page() {
  return <DataToolPage slug="html-to-markdown" />;
}
