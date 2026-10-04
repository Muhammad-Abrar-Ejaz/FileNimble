import { AI_TOOLS, type AiToolSlug } from '@/config/aiTools';
import { AiToolClient } from './AiToolClient';

export function AiToolPage({ slug }: { slug: AiToolSlug }) {
  const tool = AI_TOOLS[slug];
  return <div className="mx-auto max-w-6xl space-y-8 px-4 py-10 sm:px-6">
    <AiToolClient tool={tool} />
    <section className="mx-auto max-w-4xl rounded-2xl border border-border-subtle bg-surface p-6">
      <h2 className="text-xl font-bold">Supported input and limitations</h2>
      <p className="mt-3 text-text-muted">{tool.details} PDF processing accepts up to 10 MiB and 20 pages. Extracted or pasted text is capped at 12,000 characters. AI results are generated, may omit or misinterpret content, and are not professional advice.</p>
    </section>
    <p className="mx-auto max-w-4xl text-sm text-text-muted">This experimental tool is not included in the public tool directory or sitemap while provider, quality, and release checks remain incomplete.</p>
  </div>;
}
