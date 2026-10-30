import { toolMetadata } from '@/lib/seo';
import { ToolPageSeo } from '@/components/seo/PageSeo';
import { getToolBySlug } from '@/lib/registry';
import { SharedImageConverterClient } from '@/components/converter';
import { RelatedTools } from '@/components/tools/RelatedTools';
import { AdSlot } from '@/components/ads';
import { HelpCircle } from 'lucide-react';

export const metadata = toolMetadata('image-crop');

export default function ImageCropPage() {
  const currentTool = getToolBySlug('image-crop');

  const faqs = [
    {
      q: 'Can I crop images to exact aspect ratios like 1:1 or 16:9?',
      a: 'Yes! FileNimble includes preset buttons for standard ratios including 1:1 (Square for avatars/Instagram), 4:3 (Standard photography), and 16:9 (Widescreen/YouTube thumbnails), as well as freeform cropping.',
    },
    {
      q: 'Does cropping reduce the resolution of the image?',
      a: 'Cropping removes outer pixels outside your selection box while preserving the full pixel density of the remaining cropped area without resampling or quality loss.',
    },
    {
      q: 'Are my photos uploaded to any server?',
      a: 'No. The visual cropper and canvas pipeline process the selected image in your browser; FileNimble does not upload it for this conversion.',
    },
  ];

  return (
    <div className="py-8 sm:py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-16">
      <ToolPageSeo slug="image-crop" />
      <SharedImageConverterClient
        toolTitle="Image Cropper"
        toolDescription="Crop images visually with preset aspect ratios and exact pixel dimensions. Private and free."
        sourceFormats={['jpg', 'jpeg', 'png', 'webp']}
        targetFormat="png"
        targetMime="image/png"
        mode="crop"
      />

      <AdSlot placement="tool-after-converter" format="horizontal" tool={currentTool} />

      {/* Guide */}
      <section className="max-w-4xl mx-auto space-y-6" aria-labelledby="how-to-crop-heading">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 id="how-to-crop-heading" className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            How to Crop Images
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Cut and frame your images in three quick steps.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm text-center">
            <div className="h-12 w-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-lg mx-auto mb-4">
              1
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Upload Image</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Select or drop your image into the interactive cropper.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm text-center">
            <div className="h-12 w-12 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold text-lg mx-auto mb-4">
              2
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Select Crop Area</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Pick an aspect ratio (1:1, 4:3, 16:9, or Freeform) and adjust the visual crop box.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm text-center">
            <div className="h-12 w-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-lg mx-auto mb-4">
              3
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Download Crop</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Click Crop Image Now, check the exported dimensions, then download your PNG result.
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
