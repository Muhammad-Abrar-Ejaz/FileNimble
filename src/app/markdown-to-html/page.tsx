import { DataToolPage, dataToolMetadata } from '@/components/converter/data/DataToolPage';

export const metadata = dataToolMetadata('markdown-to-html');

export default function Page() {
  return <DataToolPage slug="markdown-to-html" />;
}
