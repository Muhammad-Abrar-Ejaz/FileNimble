import { toolMetadata } from '@/lib/seo';
import { ToolSeo } from '@/components/seo/PageSeo';
import { PDF_TOOL_PAGES } from '@/config/pdfTools';
import { getToolBySlug } from '@/lib/registry';
import { RelatedTools } from '@/components/tools/RelatedTools';
import { PdfConverterClient } from './PdfConverterClient';
import { AdSlot } from '@/components/ads';

export const pdfToolMetadata = toolMetadata;

export function PdfToolPage({ slug }: { slug: string }) {
  const content = PDF_TOOL_PAGES.find(tool => tool.slug === slug)!;
  const tool = getToolBySlug(slug)!;
  return <div className="mx-auto max-w-6xl space-y-14 px-4 py-10 sm:px-6">
    <ToolSeo slug={slug} />
    <PdfConverterClient mode={content.mode} title={content.title} description={content.description} />
    <AdSlot placement="tool-after-converter" format="horizontal" tool={tool} />
    <section className="mx-auto max-w-4xl space-y-5"><h2 className="text-2xl font-bold">How to use {content.title}</h2><ol className="grid gap-4 sm:grid-cols-3">{content.steps.map((step, index) => <li key={step} className="rounded-2xl border border-border-subtle bg-surface p-5"><span className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white font-bold">{index + 1}</span><p className="text-sm">{step}</p></li>)}</ol></section>
    <section className="mx-auto max-w-4xl space-y-4"><h2 className="text-2xl font-bold">{content.heading}</h2><p className="leading-relaxed text-text-muted">{content.explanation}</p><h3 className="font-semibold">What to expect</h3><p className="leading-relaxed text-text-muted">{content.limitations}</p></section>
    <section className="mx-auto max-w-4xl space-y-3 rounded-2xl border border-border-subtle bg-surface p-6"><h2 className="text-xl font-bold">Private browser processing and practical limits</h2><p className="text-sm leading-relaxed text-text-muted">Your PDF content is processed in this browser and is not uploaded to FileNimble. Input and output remain in memory until you clear the tool or leave the page. Downloads are saved by your browser. Large or unusually complex PDFs can exceed available device memory even below the stated limits; use a smaller plain PDF if processing fails.</p><p className="text-sm leading-relaxed text-text-muted">Encrypted PDFs, interactive forms, signed documents, portfolios, embedded files and scripts are rejected. Document-level bookmarks and navigation structures are not preserved by page-copy operations. Results are not certified archival, redacted or sanitized documents. Review important output before sharing.</p></section>
    <section className="mx-auto max-w-4xl space-y-4"><h2 className="text-2xl font-bold">Frequently Asked Questions</h2>{content.faqs.map(faq => <div key={faq.q} className="rounded-2xl border border-border-subtle bg-surface p-5"><h3 className="font-semibold">{faq.q}</h3><p className="mt-2 text-sm leading-relaxed text-text-muted">{faq.a}</p></div>)}</section>
    <RelatedTools tool={{ ...tool, relatedTools: content.related }} />
  </div>;
}
