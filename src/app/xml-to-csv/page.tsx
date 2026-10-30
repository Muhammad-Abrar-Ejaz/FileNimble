import { DataToolPage, dataToolMetadata } from '@/components/converter/data/DataToolPage';

export const metadata = dataToolMetadata('xml-to-csv');

export default function Page() {
  return <DataToolPage slug="xml-to-csv" />;
}
