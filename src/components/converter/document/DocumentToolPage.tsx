import { toolMetadata } from '@/lib/seo';
import { ToolPageSeo } from '@/components/seo/PageSeo';
import { DOCUMENT_TOOLS } from '@/config/documentTools';
import { getToolBySlug } from '@/lib/registry';
import { RelatedTools } from '@/components/tools/RelatedTools';
import { DocumentConverterClient } from './DocumentConverterClient';
import Link from 'next/link';
import { AdSlot } from '@/components/ads';

export const documentMetadata = toolMetadata;

export function DocumentToolPage({ slug }: { slug: string }) {
  const tool = DOCUMENT_TOOLS.find(item => item.slug === slug)!;
  const registry = getToolBySlug(slug)!;
  if (registry.status !== 'live') return <article className="mx-auto max-w-4xl space-y-6 px-4 py-12">
    <h1 className="text-3xl font-bold">{tool.title} — Planned</h1>
    <p>This tool is not part of the supported release and cannot process or upload files. No files are selected or uploaded on this page.</p>
    <h2 className="text-xl font-semibold">Current limitations</h2><p>{tool.limitations}</p>
    <p>Quality, security, licensing and resource-limit qualification must pass before release. No release date is promised.</p>
    <Link className="underline" href="/tools">Browse available tools</Link>
  </article>;
  return <div className="mx-auto max-w-6xl space-y-10 px-4 py-10 sm:px-6">
    <ToolPageSeo slug={slug} />
    <DocumentConverterClient tool={tool} />
    <AdSlot placement="tool-after-converter" format="horizontal" tool={registry} />
    {tool.ocr && <p className="mx-auto max-w-4xl text-sm">OCR limit: five PDF pages, four megapixels per page and sixteen megapixels total. OCR results require human review.</p>}
    <section className="mx-auto max-w-4xl space-y-4"><h2 className="text-2xl font-bold">How it works</h2><ol className="list-decimal space-y-3 pl-6">{tool.steps.map(step => <li key={step}>{step}</li>)}</ol><p>{tool.explanation}</p><h2 className="text-xl font-bold">Supported documents and limitations</h2><p>{tool.limitations}</p></section>
    <section className="mx-auto max-w-4xl space-y-3 rounded-2xl border border-border-subtle bg-surface p-6"><h2 className="text-xl font-bold">Temporary server processing</h2><p>Your file is uploaded only when you choose to convert. An isolated worker processes it without network access. Uploaded files expire after one hour; completed outputs expire one hour after completion. Failed, cancelled or deleted jobs become eligible for immediate cleanup. Service outages can delay physical deletion; a previously issued download link can remain valid briefly. Clear files to request early deletion. Downloads saved on your device remain there.</p><p>{tool.processingLimits || <>PDF processing is limited to 200 pages; HTML and reverse conversions have the stricter limits listed above. Complex files may reach time, memory or scratch limits sooner. No malware-free, perfect-fidelity or certified-accessibility claim is made.</>}</p></section>
    <section className="mx-auto max-w-4xl space-y-4"><h2 className="text-xl font-bold">Frequently asked questions</h2>{tool.faqs.map(faq => <div key={faq.q}><h3 className="font-semibold">{faq.q}</h3><p>{faq.a}</p></div>)}</section>
    <RelatedTools tool={registry} />
  </div>;
}
