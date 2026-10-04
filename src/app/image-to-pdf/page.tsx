import { toolMetadata } from '@/lib/seo';
import { ToolSeo } from '@/components/seo/PageSeo';
import { getToolBySlug } from '@/lib/registry';
import { SharedImageConverterClient } from '@/components/converter';
import { RelatedTools } from '@/components/tools/RelatedTools';
import { AdSlot } from '@/components/ads';
import { HelpCircle } from 'lucide-react';

export const metadata = toolMetadata('image-to-pdf');

export default function ImageToPdfPage() {
  const currentTool = getToolBySlug('image-to-pdf') || getToolBySlug('jpg-to-pdf');

  const faqs = [
    {
      q: 'Can I combine multiple images into a single PDF document?',
      a: 'Yes! FileNimble allows you to upload up to 20 images (JPG, PNG, or WebP) and combines them into a single multi-page PDF document in the exact order you select.',
    },
    {
      q: 'What page sizes and layouts are supported?',
      a: 'You can choose between standard A4, Letter, or Fit to Image (which sizes each page to match the exact image pixel dimensions). You can also choose between Portrait, Landscape, or Auto orientation.',
    },
    {
      q: 'Are my photos uploaded to your servers to create the PDF?',
      a: 'No. The entire PDF assembly runs client-side in your web browser. Your private documents and images never touch an external server.',
    },
    {
      q: 'Can I set custom page margins?',
      a: 'Yes. Choose 0pt, 20pt, or 40pt margins. Fit Image maps one image pixel to one PDF point, plus margins. JPEG and WebP are rendered to PNG pixels for embedding, so the PDF can be larger than the source files. Animation and source metadata are not retained.',
    },
  ];

  return (
    <div className="py-8 sm:py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-16">
      <ToolSeo slug="image-to-pdf" />
      <SharedImageConverterClient
        toolTitle="Image to PDF Converter"
        toolDescription="Convert JPG, PNG, and WebP images into clean, printable PDF documents. Combine multiple images or save separately."
        sourceFormats={['jpg', 'jpeg', 'png', 'webp']}
        targetFormat="pdf"
        targetMime="application/pdf"
        mode="pdf"
      />

      <AdSlot placement="tool-after-converter" format="horizontal" tool={currentTool} />

      {/* Guide */}
      <section className="max-w-4xl mx-auto space-y-6" aria-labelledby="how-to-pdf-heading">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 id="how-to-pdf-heading" className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            How to Convert Images to PDF
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Create professional PDF documents from photos and scans in three simple steps.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm text-center">
            <div className="h-12 w-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-lg mx-auto mb-4">
              1
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Upload Images</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Drag & drop up to 20 JPG, PNG, or WebP images into the uploader.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm text-center">
            <div className="h-12 w-12 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold text-lg mx-auto mb-4">
              2
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Configure PDF</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Choose your page format (A4, Letter, Fit to image), margins, and whether to merge into 1 PDF.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm text-center">
            <div className="h-12 w-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-lg mx-auto mb-4">
              3
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Download PDF</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Download your compiled PDF document instantly with standard PDF formatting.
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

      {currentTool?.relatedTools && currentTool.relatedTools.length > 0 && (
        <section className="max-w-5xl mx-auto border-t border-slate-200 dark:border-slate-800 pt-12">
          <RelatedTools tool={currentTool} />
        </section>
      )}
    </div>
  );
}
