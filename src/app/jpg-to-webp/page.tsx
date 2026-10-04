import { toolMetadata } from '@/lib/seo';
import { ToolSeo } from '@/components/seo/PageSeo';
import { getToolBySlug } from '@/lib/registry';
import { SharedImageConverterClient } from '@/components/converter';
import { RelatedTools } from '@/components/tools/RelatedTools';
import { AdSlot } from '@/components/ads';
import { HelpCircle } from 'lucide-react';

export const metadata = toolMetadata('jpg-to-webp');

export default function JpgToWebpPage() {
  const currentTool = getToolBySlug('jpg-to-webp');

  const faqs = [
    {
      q: 'Why convert JPG to WebP?',
      a: 'WebP is a modern image format developed by Google that delivers superior lossy compression compared to JPEG. File size depends on image content and quality; this converter shows the actual result rather than promising a fixed saving.',
    },
    {
      q: 'Do all modern browsers support WebP?',
      a: 'Yes. WebP is supported by all major modern web browsers including Google Chrome, Apple Safari (iOS and macOS), Mozilla Firefox, and Microsoft Edge.',
    },
    {
      q: 'Are my images uploaded to any server during conversion?',
      a: 'No. FileNimble converts your JPG images to WebP directly on your device using native browser Canvas APIs. Zero image data is sent across the network.',
    },
    {
      q: 'What quality setting is recommended for JPG to WebP?',
      a: 'Start at 80% and inspect the download. Lower quality can introduce visible artifacts; higher settings may increase size.',
    },
  ];

  return (
    <div className="py-8 sm:py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-16">
      <ToolSeo slug="jpg-to-webp" />
      <SharedImageConverterClient
        toolTitle="JPG to WebP Converter"
        toolDescription="Convert JPEG images to next-gen WebP format for smaller file sizes and faster page loads."
        sourceFormats={['jpg', 'jpeg']}
        targetFormat="webp"
        targetMime="image/webp"
        defaultQuality={0.8}
        mode="convert"
      />

      <AdSlot placement="tool-after-converter" format="horizontal" tool={currentTool} />

      {/* Guide */}
      <section className="max-w-4xl mx-auto" aria-labelledby="how-to-convert-heading">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 id="how-to-convert-heading" className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            How to Convert JPG to WebP
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Speed up your website by converting JPEG files into lightweight WebP format.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm text-center">
            <div className="h-12 w-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-lg mx-auto mb-4">
              1
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Upload JPGs</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Drag and drop your JPG or JPEG files into the secure drop zone.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm text-center">
            <div className="h-12 w-12 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold text-lg mx-auto mb-4">
              2
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Adjust Quality</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Select your desired compression quality slider (80% default recommended).
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm text-center">
            <div className="h-12 w-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-lg mx-auto mb-4">
              3
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Download WebP</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Download individual WebP files or click Download All as ZIP for batches.
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
