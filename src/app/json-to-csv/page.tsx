import { DataToolPage, dataToolMetadata } from '@/components/converter/data/DataToolPage';

export const metadata = dataToolMetadata('json-to-csv');

export default function Page() {
  return <DataToolPage slug="json-to-csv" />;
}
