import Link from 'next/link';
import { availableFormats, formatGuides, toolsForFormat } from '@/config/formats';
import { pageMetadata } from '@/lib/seo';
import { Breadcrumbs } from '@/components/seo/PageSeo';
import { AdSlot } from '@/components/ads';

export const metadata = pageMetadata('/formats', 'File Format Guides and Converters | FileNimble', 'Find available converters by format and learn the practical differences between PDF, images, documents and structured data.');
export default function FormatsPage() {
  return <div className="mx-auto max-w-6xl space-y-8 px-4 py-12 sm:px-6">
    <Breadcrumbs items={[{ name: 'Home', path: '/' }, { name: 'Formats', path: '/formats' }]} />
    <h1 className="text-3xl font-bold">File formats and available converters</h1>
    <p>Choose a format to see what it preserves, what can change during conversion, and tools that currently accept or produce it. A format listing does not imply support for every possible conversion.</p>
    <ul className="grid gap-5 sm:grid-cols-2">{availableFormats().map(format => <li key={format} className="rounded-2xl border border-border-subtle bg-surface p-6 space-y-3"><h2 className="text-xl font-semibold"><Link className="underline" href={`/formats/${format}`}>{formatGuides[format].name}</Link></h2><p>{formatGuides[format].summary}</p><p className="text-sm text-text-muted">{toolsForFormat(format).length} available tools</p></li>)}</ul>
    <AdSlot placement="formats-bottom" format="horizontal" />
  </div>;
}
