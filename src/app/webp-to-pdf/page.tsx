import { toolMetadata } from '@/lib/seo';
import { ToolPageSeo } from '@/components/seo/PageSeo';
import { getToolBySlug } from '@/lib/registry';
import { SharedImageConverterClient } from '@/components/converter';
import { RelatedTools } from '@/components/tools/RelatedTools';
import { AdSlot } from '@/components/ads';
import { HelpCircle } from 'lucide-react';

export const metadata = toolMetadata('webp-to-pdf');

export default function WebpToPdfPage() {
  const currentTool = getToolBySlug('webp-to-pdf');

  const faqs = [
    {
      q: 'Why convert WebP to PDF?',
      a: 'While WebP is great for web browsers, PDF is the universal standard for printing, official document submissions, and multi-page document archiving.',
    },
    {
      q: 'Are my WebP images uploaded to any server?',
      a: 'No. The entire conversion process occurs within your browser using local canvas decoding and pdf-lib.',
    },
    {
      q: 'Can I combine multiple WebP images into a single document?',
      a: 'Yes. You can combine up to 20 WebP files into a single continuous PDF document in your chosen order.',
    },
    {
      q: 'Does it support both lossy and lossless WebP?',
      a: 'Yes. Both lossy photography WebP and lossless graphics/alpha WebP formats are decoded and rendered onto standard PDF pages.',
    },
  ];

  return (
    <div className="py-8 sm:py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-16">
      <ToolPageSeo slug="webp-to-pdf" />

      <SharedImageConverterClient
        toolTitle="WebP to PDF Converter"
        toolDescription="Convert modern WebP images into universal, printable PDF documents directly in your browser."
        sourceFormats={['webp']}
        targetFormat="pdf"
        targetMime="application/pdf"
        mode="pdf"
      />

      <AdSlot placement="tool-after-converter" format="horizontal" tool={currentTool} />

      {/* Guide */}
      <section className="max-w-4xl mx-auto space-y-6" aria-labelledby="how-to-pdf-heading">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 id="how-to-pdf-heading" className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            How to Convert WebP to PDF
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Create professional PDF documents from WebP images in three simple steps.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm text-center">
            <div className="h-12 w-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-lg mx-auto mb-4">
              1
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Upload WebP Files</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Select or drag and drop up to 20 WebP images from your device.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm text-center">
            <div className="h-12 w-12 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold text-lg mx-auto mb-4">
              2
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Configure PDF Options</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Select page format (A4, Letter, or Fit), margins, and orientation.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm text-center">
            <div className="h-12 w-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-lg mx-auto mb-4">
              3
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Download PDF</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Click Convert to PDF and download your compiled PDF document.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ Accordions */}
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

      {/* Related Tools */}
      {currentTool && (
        <section className="max-w-5xl mx-auto border-t border-slate-200 dark:border-slate-800 pt-12">
          <RelatedTools tool={currentTool} />
        </section>
      )}
    </div>
  );
}
