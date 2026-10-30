import { DataToolPage, dataToolMetadata } from '@/components/converter/data/DataToolPage';

export const metadata = dataToolMetadata('tsv-to-csv');

export default function Page() {
  return <DataToolPage slug="tsv-to-csv" />;
}
