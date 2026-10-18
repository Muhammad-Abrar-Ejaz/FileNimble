import { toolMetadata } from '@/lib/seo';
import { ToolSeo } from '@/components/seo/PageSeo';
import { getToolBySlug } from '@/lib/registry';
import { SharedImageConverterClient } from '@/components/converter';
import { RelatedTools } from '@/components/tools/RelatedTools';
import { AdSlot } from '@/components/ads';
import { HelpCircle } from 'lucide-react';

export const metadata = toolMetadata('image-resize');

export default function ImageResizePage() {
  const currentTool = getToolBySlug('image-resize');

  const faqs = [
    {
      q: 'Can I lock the aspect ratio while resizing?',
      a: 'Yes. By default, the aspect ratio lock is enabled. Entering a new width will automatically calculate the proportional height, preventing unwanted image stretching or distortion.',
    },
    {
      q: 'What formats can I resize?',
      a: 'You can resize JPG, JPEG, PNG, and WebP images. FileNimble retains the original format and transparency where applicable.',
    },
    {
      q: 'Does resizing decrease image quality?',
      a: 'Downscaling an image reduces pixel count and file size while keeping visual clarity crisp. Upscaling beyond the original resolution cannot invent missing detail, but FileNimble applies browser-provided high-quality Canvas smoothing. Upscaling is disabled unless you explicitly enable it.',
    },
    {
      q: 'Are my photos uploaded to a server?',
      a: 'No. This resizing conversion runs in your browser using HTML5 Canvas; FileNimble does not upload the selected image for this conversion.',
    },
  ];

  return (
    <div className="py-8 sm:py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-16">
      <ToolSeo slug="image-resize" />
      <SharedImageConverterClient
        toolTitle="Image Resizer"
        toolDescription="Change image pixel dimensions while locking aspect ratio. Fast, private, and free."
        sourceFormats={['jpg', 'jpeg', 'png', 'webp']}
        targetFormat="jpg"
        targetMime="image/jpeg"
        mode="resize"
      />

      <AdSlot placement="tool-after-converter" format="horizontal" tool={currentTool} />

      {/* Guide */}
      <section className="max-w-4xl mx-auto space-y-6" aria-labelledby="how-to-resize-heading">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 id="how-to-resize-heading" className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            How to Resize Images
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Quickly adjust image dimensions in three simple steps.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm text-center">
            <div className="h-12 w-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-lg mx-auto mb-4">
              1
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Upload Images</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Select or drop your JPG, PNG, or WebP images into the uploader.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm text-center">
            <div className="h-12 w-12 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold text-lg mx-auto mb-4">
              2
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Set Dimensions</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Enter target width or height, lock aspect ratio, or pick a preset.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm text-center">
            <div className="h-12 w-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-lg mx-auto mb-4">
              3
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Download Resized</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Download your newly resized images instantly or package them as a ZIP.
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
