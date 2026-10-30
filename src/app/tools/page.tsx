import Link from 'next/link';
import { CATEGORIES } from '@/config/categories';
import { pageMetadata, publicTools } from '@/lib/seo';
import { ToolCard } from '@/components/tools/ToolCard';
import { Breadcrumbs } from '@/components/seo/PageSeo';
import { AdSlot } from '@/components/ads';
import { JsonLd, pageGraph } from '@/lib/jsonld';

export const metadata = pageMetadata('/tools', 'Available File Conversion Tools | FileNimble', 'Browse ready browser tools and the available TAR to ZIP and ZIP to TAR server conversions. Tools marked Planned are unavailable in this release.');
export default function ToolsPage() {
  const tools = publicTools();
  const categories = Object.values(CATEGORIES).filter(category => tools.some(tool => tool.category === category.id));
  const jsonLdData = pageGraph({
    path: '/tools',
    type: 'CollectionPage',
    name: 'Available File Conversion Tools | FileNimble',
    description: 'Browse ready browser tools and the available TAR to ZIP and ZIP to TAR server conversions. Tools marked Planned are unavailable in this release.',
    crumbLabel: 'Tools',
    items: tools.map(tool => ({ name: tool.title!, path: `/${tool.slug}` })),
  });

  return <div className="mx-auto max-w-7xl space-y-10 px-4 py-12 sm:px-6">
    <JsonLd data={jsonLdData} />
    <Breadcrumbs items={[{ name: 'Home', path: '/' }, { name: 'Tools', path: '/tools' }]} emitJsonLd={false} />
    <header className="space-y-4"><h1 className="text-3xl font-bold">Available conversion tools</h1><p>{tools.length} available tools. Browser tools process files on your device; the only server conversions in this release are TAR to ZIP and ZIP to TAR, using temporary uploads. Each available page explains its formats and limits.</p><p><Link className="underline" href="/formats">Browse by file format</Link> or read <Link className="underline" href="/privacy">how files are handled</Link>.</p></header>
    <nav aria-label="Tool categories" className="flex flex-wrap gap-4">{categories.map(category => <a className="underline" key={category.id} href={`#${category.id}`}>{category.name}</a>)}</nav>
    {categories.map(category => <section key={category.id} id={category.id} className="space-y-5 scroll-mt-24"><h2 className="text-2xl font-bold">{category.name}</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{tools.filter(tool => tool.category === category.id).map(tool => <ToolCard key={tool.slug} tool={tool} />)}</div></section>)}
    <AdSlot placement="directory-bottom" format="horizontal" />
  </div>;
}
