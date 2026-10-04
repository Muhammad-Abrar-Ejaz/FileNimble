import { notFound } from 'next/navigation';
import Link from 'next/link';
import { availableFormats, formatGuides, toolsForFormat } from '@/config/formats';
import { pageMetadata } from '@/lib/seo';
import { Breadcrumbs } from '@/components/seo/PageSeo';
import { ToolCard } from '@/components/tools/ToolCard';

export const dynamicParams = false;
export function generateStaticParams() { return availableFormats().map(format => ({ format })); }
export async function generateMetadata({ params }: { params: Promise<{ format: string }> }) {
  const { format } = await params;
  if (!availableFormats().includes(format)) notFound();
  const guide = formatGuides[format];
  return pageMetadata(`/formats/${format}`, `${guide.name} Format Guide and Tools | FileNimble`, guide.summary);
}
export default async function FormatPage({ params }: { params: Promise<{ format: string }> }) {
  const { format } = await params;
  if (!availableFormats().includes(format)) notFound();
  const guide = formatGuides[format];
  return <article className="mx-auto max-w-6xl space-y-8 px-4 py-12 sm:px-6">
    <Breadcrumbs items={[{ name: 'Home', path: '/' }, { name: 'Formats', path: '/formats' }, { name: guide.name, path: `/formats/${format}` }]} />
    <h1 className="text-3xl font-bold">{guide.name} format guide and tools</h1><p>{guide.summary}</p>
    <section className="space-y-3"><h2 className="text-xl font-semibold">Before you convert</h2><p>{guide.advice}</p><p>Check each tool’s processing label: <Link className="underline" href="/privacy">browser and server tools handle files differently</Link>.</p></section>
    <section className="space-y-5"><h2 className="text-2xl font-bold">Available {guide.name} tools</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{toolsForFormat(format).map(tool => <ToolCard key={tool.slug} tool={tool} />)}</div></section>
  </article>;
}
