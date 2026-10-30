import { toolMetadata } from '@/lib/seo';
import { ToolPageSeo } from '@/components/seo/PageSeo';
import { getToolBySlug } from '@/lib/registry';
import { SharedImageConverterClient } from '@/components/converter';
import { RelatedTools } from '@/components/tools/RelatedTools';
import { AdSlot } from '@/components/ads';
import { HelpCircle } from 'lucide-react';

export const metadata = toolMetadata('jpg-to-pdf');

export default function JpgToPdfPage() {
  const currentTool = getToolBySlug('jpg-to-pdf');

  const faqs = [
    {
      q: 'Can I combine multiple JPG photos into one PDF?',
      a: 'Yes. You can select up to 20 JPG images and combine them into a single ordered multi-page PDF document, or choose to download them as separate PDF pages.',
    },
    {
      q: 'Are my JPG photos uploaded to a server?',
      a: 'No. The entire PDF generation runs locally in your browser using pdf-lib. Your private photos never leave your device.',
    },
    {
      q: 'What page sizes and orientations are supported?',
      a: 'FileNimble supports standard A4, US Letter, and Fit to Image page sizes, with Portrait, Landscape, or Auto orientation.',
    },
    {
      q: 'Can I customize page margins?',
      a: 'Yes. You can select 0pt (borderless), 20pt (standard), or 40pt (wide) margins for your PDF pages.',
    },
  ];

  return (
    <div className="py-8 sm:py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-16">
      <ToolPageSeo slug="jpg-to-pdf" />

      <SharedImageConverterClient
        toolTitle="JPG to PDF Converter"
        toolDescription="Convert JPG and JPEG photos into clean, paginated PDF documents with custom margins and page formats directly in your browser."
        sourceFormats={['jpg', 'jpeg']}
        targetFormat="pdf"
        targetMime="application/pdf"
        mode="pdf"
      />

      <AdSlot placement="tool-after-converter" format="horizontal" tool={currentTool} />

      {/* Guide */}
      <section className="max-w-4xl mx-auto space-y-6" aria-labelledby="how-to-pdf-heading">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 id="how-to-pdf-heading" className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            How to Convert JPG to PDF
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Create professional PDF documents from JPG photos in three simple steps.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm text-center">
            <div className="h-12 w-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-lg mx-auto mb-4">
              1
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Upload JPG Photos</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Drag & drop or select up to 20 JPG files from your computer or phone.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm text-center">
            <div className="h-12 w-12 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold text-lg mx-auto mb-4">
              2
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Configure Layout</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Choose your page size (A4, Letter, Fit), orientation, margins, and whether to merge into 1 PDF.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm text-center">
            <div className="h-12 w-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-lg mx-auto mb-4">
              3
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Download PDF</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Click Convert to PDF to generate and download your clean PDF document instantly.
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
