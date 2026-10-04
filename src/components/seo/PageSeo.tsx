import Link from 'next/link';
import { TOOLS_BY_SLUG } from '@/config/tools';
import { canonicalUrl, isIndexableTool, serializeJsonLd } from '@/lib/seo';

export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}

export function Breadcrumbs({ items }: { items: { name: string; path: string }[] }) {
  return <>
    <nav aria-label="Breadcrumb" className="text-sm text-text-muted">
      <ol className="flex flex-wrap gap-2">{items.map((item, i) => <li key={item.path}>
        {i > 0 && <span aria-hidden="true" className="mr-2">/</span>}
        {i === items.length - 1 ? <span aria-current="page">{item.name}</span> : <Link className="underline focus-visible:outline-2 focus-visible:outline-primary" href={item.path}>{item.name}</Link>}
      </li>)}</ol>
    </nav>
    <JsonLd data={{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map((item, i) => ({ '@type': 'ListItem', position: i + 1, name: item.name, item: canonicalUrl(item.path) })) }} />
  </>;
}

export function ToolSeo({ slug }: { slug: string }) {
  const tool = TOOLS_BY_SLUG.get(slug);
  if (!tool || !isIndexableTool(tool)) return null;
  return <>
    <Breadcrumbs items={[{ name: 'Home', path: '/' }, { name: 'Tools', path: '/tools' }, { name: tool.title!, path: `/${slug}` }]} />
    <JsonLd data={{ '@context': 'https://schema.org', '@type': 'WebApplication', '@id': canonicalUrl(`/${slug}`) + '#application', name: tool.title, description: tool.seoDescription, url: canonicalUrl(`/${slug}`), applicationCategory: 'UtilitiesApplication', operatingSystem: 'Web browser' }} />
  </>;
}
