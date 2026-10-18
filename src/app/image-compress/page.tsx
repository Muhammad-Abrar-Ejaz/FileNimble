import { toolMetadata } from '@/lib/seo';
import { ToolSeo } from '@/components/seo/PageSeo';
import { getToolBySlug } from '@/lib/registry';
import { SharedImageConverterClient } from '@/components/converter';
import { RelatedTools } from '@/components/tools/RelatedTools';
import { AdSlot } from '@/components/ads';
import { HelpCircle, AlertCircle } from 'lucide-react';

export const metadata = toolMetadata('image-compress');

export default function ImageCompressPage() {
  const currentTool = getToolBySlug('image-compress');

  const faqs = [
    {
      q: 'How does browser-side image compression work?',
      a: 'FileNimble passes your quality setting to the browser JPEG or WebP encoder. Lower quality can discard visible detail. Actual output can be smaller or larger; compare the generated result before keeping it.',
    },
    {
      q: 'Can PNG files be compressed using a quality slider?',
      a: 'No. PNG is strictly a lossless format. Standard browser encoders do not support lossy quality reduction for PNG. If you need substantial file size reductions for PNGs, FileNimble offers the option to convert them to lossy WebP, which supports transparency. Savings depend on the image and are not guaranteed.',
    },
    {
      q: 'Are percentage savings estimated or real?',
      a: 'All savings shown on FileNimble are calculated directly from the real output file size compared to the original input file size (never estimated or faked).',
    },
    {
      q: 'Are my images uploaded to any server?',
      a: 'No. This compression tool processes the selected image in your browser; FileNimble does not upload it for this conversion.',
    },
  ];

  return (
    <div className="py-8 sm:py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-16">
      <ToolSeo slug="image-compress" />
      <SharedImageConverterClient
        toolTitle="Image Compressor"
        toolDescription="Shrink image file size with real-time quality control. Fast, private, and 100% browser-based."
        sourceFormats={['jpg', 'jpeg', 'png', 'webp']}
        targetFormat="jpg"
        targetMime="image/jpeg"
        defaultQuality={0.8}
        mode="compress"
      />

      <AdSlot placement="tool-after-converter" format="horizontal" tool={currentTool} />

      {/* Honest PNG Compression Explanation */}
      <section className="max-w-4xl mx-auto rounded-2xl border border-amber-200 bg-amber-50/70 p-6 sm:p-8 dark:border-amber-900/50 dark:bg-amber-950/30">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-amber-100 p-2.5 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 shrink-0">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-amber-950 dark:text-amber-200">
              Lossless PNG vs Lossy Compression
            </h3>
            <p className="text-sm leading-relaxed text-amber-900 dark:text-amber-300">
              PNG is a lossless format, which means browser canvas encoders use lossless output encoding and
              ignore lossy quality sliders. When compressing PNG images, FileNimble gives you the choice to keep
              them as lossless PNGs or convert them to modern WebP for lossy encoding while
              preserving transparency.
            </p>
          </div>
        </div>
      </section>

      {/* Guide */}
      <section className="max-w-4xl mx-auto space-y-6" aria-labelledby="how-to-compress-heading">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 id="how-to-compress-heading" className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            How to Compress Images
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Optimize your images in seconds with zero loss of visible clarity.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm text-center">
            <div className="h-12 w-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-lg mx-auto mb-4">
              1
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Upload Files</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Select or drop your JPG, PNG, or WebP images into the uploader.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm text-center">
            <div className="h-12 w-12 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold text-lg mx-auto mb-4">
              2
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Adjust Quality</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              For JPEG or WebP, adjust quality (80% default) and inspect the result. PNG uses lossless encoding without a quality slider.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm text-center">
            <div className="h-12 w-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-lg mx-auto mb-4">
              3
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Download Optimized</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              See the real percentage saved and download your files individually or as a ZIP.
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
