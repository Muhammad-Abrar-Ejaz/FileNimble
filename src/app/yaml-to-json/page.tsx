import { DataToolPage, dataToolMetadata } from '@/components/converter/data/DataToolPage';

export const metadata = dataToolMetadata('yaml-to-json');

export default function Page() {
  return <DataToolPage slug="yaml-to-json" />;
}
