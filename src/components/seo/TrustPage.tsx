import Link from 'next/link';
import { trustPages, supportEmail } from '@/config/trust';
import { Breadcrumbs } from './PageSeo';
import { JsonLd, pageGraph } from '@/lib/jsonld';

export function TrustPage({ slug }: { slug: keyof typeof trustPages }) {
  const page = trustPages[slug];
  const email = slug === 'contact' ? supportEmail() : undefined;
  const pageType: 'AboutPage' | 'ContactPage' | 'WebPage' =
    slug === 'about' ? 'AboutPage' : slug === 'contact' ? 'ContactPage' : 'WebPage';
  const jsonLdData = pageGraph({
    path: `/${slug}`,
    type: pageType,
    name: `${page.title} | FileNimble`,
    description: page.description,
    crumbLabel: page.title,
  });

  return <article className="mx-auto max-w-4xl space-y-8 px-4 py-12 sm:px-6">
    <JsonLd data={jsonLdData} />
    <Breadcrumbs items={[{ name: 'Home', path: '/' }, { name: page.title, path: `/${slug}` }]} emitJsonLd={false} />
    <header className="space-y-4"><h1 className="text-3xl font-bold">{page.title}</h1><p className="text-text-muted leading-relaxed">{page.description}</p></header>
    {slug === 'contact' && <section className="rounded-2xl border border-border-subtle bg-surface p-6 space-y-3"><h2 className="text-xl font-semibold">Support channel</h2>{email ? <p>Email <a className="underline" href={`mailto:${email}`}>{email}</a>.</p> : <p>A public support email has not been configured for this deployment. There is no active contact form here. If you are using a privately shared instance, contact the person who provided access.</p>}</section>}
    {page.sections.map(([heading, body]) => <section key={heading} className="space-y-3"><h2 className="text-xl font-semibold">{heading}</h2><p className="leading-relaxed text-text-muted">{body}</p></section>)}
    <nav aria-label="FileNimble information" className="flex flex-wrap gap-5 border-t border-border-subtle pt-6">
      {Object.entries(trustPages).filter(([key]) => key !== slug).map(([key, item]) => <Link key={key} className="underline" href={`/${key}`}>{item.title}</Link>)}
      <Link className="underline" href="/tools">Available conversion tools</Link>
    </nav>
  </article>;
}
