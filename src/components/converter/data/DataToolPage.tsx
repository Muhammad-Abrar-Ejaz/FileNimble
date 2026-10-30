import { toolMetadata } from '@/lib/seo';
import { ToolPageSeo } from '@/components/seo/PageSeo';
import { getDataToolBySlug } from '@/config/dataTools';
import { getToolBySlug } from '@/lib/registry';
import { RelatedTools } from '@/components/tools/RelatedTools';
import { DataConverterClient } from './DataConverterClient';
import { AdSlot } from '@/components/ads';

export const dataToolMetadata = toolMetadata;

export function DataToolPage({ slug }: { slug: string }) {
  const content = getDataToolBySlug(slug)!;
  const tool = getToolBySlug(slug)!;

  return (
    <div className="mx-auto max-w-6xl space-y-14 px-4 py-10 sm:px-6">
      <ToolPageSeo slug={slug} />
      <DataConverterClient tool={content} />
      <AdSlot placement="tool-after-converter" format="horizontal" tool={tool} />

      <section className="mx-auto max-w-4xl space-y-5">
        <h2 className="text-2xl font-bold text-text-primary">How to use {content.title}</h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {content.steps.map((step, index) => (
            <li
              key={step}
              className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm"
            >
              <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white font-bold text-sm">
                {index + 1}
              </span>
              <p className="text-sm text-text-primary leading-relaxed">{step}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-4xl space-y-4">
        <h2 className="text-2xl font-bold text-text-primary">{content.heading}</h2>
        <p className="leading-relaxed text-text-muted">{content.explanation}</p>
        <h3 className="font-semibold text-lg text-text-primary">What to expect and limitations</h3>
        <p className="leading-relaxed text-text-muted">{content.limitations}</p>
      </section>

      <section className="mx-auto max-w-4xl space-y-3 rounded-2xl border border-border-subtle bg-surface p-6 shadow-sm">
        <h2 className="text-xl font-bold text-text-primary">Private browser processing</h2>
        <p className="text-sm leading-relaxed text-text-muted">
          Your data is parsed, validated, and converted entirely in your web browser. File content
          is never transmitted over the internet to FileNimble servers. All calculations run in your
          local browser memory. Clearing the tool or leaving the page releases application references; this is not a guarantee of secure memory erasure. Saved downloads remain on your device.
        </p>
        <p className="text-sm leading-relaxed text-text-muted">
          Formula injection prevention is applied by default when generating CSV output to help protect
          against remote command execution and exfiltration attacks when opening files in spreadsheet
          applications such as Microsoft Excel and Google Sheets.
        </p>
      </section>

      <section className="mx-auto max-w-4xl space-y-4">
        <h2 className="text-2xl font-bold text-text-primary">Frequently Asked Questions</h2>
        <div className="space-y-4">
          {content.faqs.map(faq => (
            <div
              key={faq.q}
              className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm"
            >
              <h3 className="font-semibold text-text-primary text-base">{faq.q}</h3>
              <p className="mt-2 text-sm leading-relaxed text-text-muted">{faq.a}</p>
            </div>
          ))}
        </div>
      </section>

      <RelatedTools tool={{ ...tool, relatedTools: content.related }} />
    </div>
  );
}
