import { DataToolPage, dataToolMetadata } from '@/components/converter/data/DataToolPage';

export const metadata = dataToolMetadata('html-table-to-csv');

export default function Page() {
  return <DataToolPage slug="html-table-to-csv" />;
}
