import { DataToolPage, dataToolMetadata } from '@/components/converter/data/DataToolPage';

export const metadata = dataToolMetadata('csv-to-tsv');

export default function Page() {
  return <DataToolPage slug="csv-to-tsv" />;
}
