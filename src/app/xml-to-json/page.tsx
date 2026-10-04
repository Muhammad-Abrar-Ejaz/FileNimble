import { DataToolPage, dataToolMetadata } from '@/components/converter/data/DataToolPage';

export const metadata = dataToolMetadata('xml-to-json');

export default function Page() {
  return <DataToolPage slug="xml-to-json" />;
}
