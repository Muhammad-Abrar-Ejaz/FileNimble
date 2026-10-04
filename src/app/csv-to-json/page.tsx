import { DataToolPage, dataToolMetadata } from '@/components/converter/data/DataToolPage';

export const metadata = dataToolMetadata('csv-to-json');

export default function Page() {
  return <DataToolPage slug="csv-to-json" />;
}
