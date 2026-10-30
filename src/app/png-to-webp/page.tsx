import { toolMetadata } from '@/lib/seo';
import { ToolPageSeo } from '@/components/seo/PageSeo';
import { getToolBySlug } from '@/lib/registry';
import { SharedImageConverterClient } from '@/components/converter';
import { RelatedTools } from '@/components/tools/RelatedTools';
import { AdSlot } from '@/components/ads';
import { HelpCircle, CheckCircle2 } from 'lucide-react';

export const metadata = toolMetadata('png-to-webp');

export default function PngToWebpPage() {
  const currentTool = getToolBySlug('png-to-webp');

  const faqs = [
    {
      q: 'Does WebP support transparent PNG backgrounds?',
      a: 'Yes! Unlike JPG, WebP includes native support for 8-bit alpha channel transparency. Converting your transparent PNGs to WebP will keep all transparent areas intact with file size determined by content and quality.',
    },
    {
      q: 'How much smaller is WebP compared to PNG?',
      a: 'There is no fixed reduction. WebP output depends on image content and quality, and small or already optimized PNGs can become larger. Compare actual results.',
    },
    {
      q: 'Are my PNG files uploaded to a remote server?',
      a: 'No. FileNimble executes the full conversion directly in your browser using HTML5 Canvas APIs. Your files never leave your computer.',
    },
  ];

  return (
    <div className="py-8 sm:py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-16">
      <ToolPageSeo slug="png-to-webp" />
      <SharedImageConverterClient
        toolTitle="PNG to WebP Converter"
        toolDescription="Convert PNG files to WebP with full transparency preservation and adjustable lossy quality."
        sourceFormats={['png']}
        targetFormat="webp"
        targetMime="image/webp"
        defaultQuality={0.85}
        mode="convert"
      />

      <AdSlot placement="tool-after-converter" format="horizontal" tool={currentTool} />

      {/* Feature highlight */}
      <section className="max-w-4xl mx-auto rounded-2xl border border-emerald-200 bg-emerald-50/60 p-6 sm:p-8 dark:border-emerald-900/50 dark:bg-emerald-950/30">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-emerald-100 p-2.5 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 shrink-0">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-emerald-950 dark:text-emerald-200">
              Alpha Transparency is Fully Preserved
            </h3>
            <p className="text-sm leading-relaxed text-emerald-900 dark:text-emerald-300">
              Unlike JPEG conversion, WebP fully supports transparent pixels. Your icons, logos, and transparent
              graphics will retain their exact transparent backgrounds without needing background color fills.
            </p>
          </div>
        </div>
      </section>

      {/* Guide */}
      <section className="max-w-4xl mx-auto space-y-6" aria-labelledby="how-to-convert-heading">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 id="how-to-convert-heading" className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            How to Convert PNG to WebP
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Three simple steps to modernize and shrink your PNG images.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm text-center">
            <div className="h-12 w-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-lg mx-auto mb-4">
              1
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Upload PNGs</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Drop your PNG files into the uploader. Batches up to 20 files are supported.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm text-center">
            <div className="h-12 w-12 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold text-lg mx-auto mb-4">
              2
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Select Quality</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Pick your preferred compression level (85% default preserves crisp transparent edges).
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm text-center">
            <div className="h-12 w-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-lg mx-auto mb-4">
              3
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Download WebP</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Save your lightweight WebP images individually or download all as a convenient ZIP.
            </p>
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="max-w-4xl mx-auto space-y-6" aria-labelledby="faq-heading">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 px-3 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-2">
            <HelpCircle className="h-3.5 w-3.5" />
            Common Questions
          </div>
          <h2 id="faq-heading" className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Frequently Asked Questions
          </h2>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm"
            >
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-2">
                {faq.q}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {faq.a}
              </p>
            </div>
          ))}
        </div>
      </section>

      {currentTool && (
        <section className="max-w-5xl mx-auto border-t border-slate-200 dark:border-slate-800 pt-12">
          <RelatedTools tool={currentTool} />
        </section>
      )}
    </div>
  );
}
