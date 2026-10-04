import { toolMetadata } from '@/lib/seo';
import { ToolSeo } from '@/components/seo/PageSeo';
import { getToolBySlug } from '@/lib/registry';
import { SharedImageConverterClient } from '@/components/converter';
import { RelatedTools } from '@/components/tools/RelatedTools';
import { AdSlot } from '@/components/ads';
import { HelpCircle, AlertCircle } from 'lucide-react';

export const metadata = toolMetadata('webp-to-jpg');

export default function WebpToJpgPage() {
  const currentTool = getToolBySlug('webp-to-jpg');

  const faqs = [
    {
      q: 'Why convert WebP to JPG?',
      a: 'Although WebP is modern and compact, some older desktop image viewers, printers, document editors, and legacy websites only accept JPG/JPEG files. Converting to JPG ensures universal compatibility everywhere.',
    },
    {
      q: 'What happens if my WebP has a transparent background?',
      a: 'JPG files do not support transparency. FileNimble lets you select a background color (White by default, Black, or a custom color) to fill any transparent areas smoothly before generating the JPG.',
    },
    {
      q: 'Are my images uploaded to your servers?',
      a: 'Never. The conversion is performed 100% in your browser using HTML5 Canvas. Your images remain private on your computer.',
    },
    {
      q: 'Can I choose the JPG output quality?',
      a: 'Yes. Use the quality slider to pick your desired compression level between 10% and 100% (85% recommended).',
    },
  ];

  return (
    <div className="py-8 sm:py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-16">
      <ToolSeo slug="webp-to-jpg" />
      <SharedImageConverterClient
        toolTitle="WebP to JPG Converter"
        toolDescription="Convert modern WebP images to universally compatible JPG/JPEG format directly in your browser."
        sourceFormats={['webp']}
        targetFormat="jpg"
        targetMime="image/jpeg"
        defaultQuality={0.85}
        showBackgroundOption={true}
        mode="convert"
      />

      <AdSlot placement="tool-after-converter" format="horizontal" tool={currentTool} />

      {/* Transparency Note */}
      <section className="max-w-4xl mx-auto rounded-2xl border border-amber-200 bg-amber-50/70 p-6 sm:p-8 dark:border-amber-900/50 dark:bg-amber-950/30">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-amber-100 p-2.5 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 shrink-0">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-amber-950 dark:text-amber-200">
              Transparency Handling for JPG Output
            </h3>
            <p className="text-sm leading-relaxed text-amber-900 dark:text-amber-300">
              JPG does not support transparent layers. If your input WebP image contains transparency,
              FileNimble flattens the transparent pixels onto the solid background color you choose in the options bar
              (white by default).
            </p>
          </div>
        </div>
      </section>

      {/* Guide */}
      <section className="max-w-4xl mx-auto space-y-6" aria-labelledby="how-to-convert-heading">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 id="how-to-convert-heading" className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            How to Convert WebP to JPG
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Easily convert your WebP images to universally compatible JPEGs.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm text-center">
            <div className="h-12 w-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-lg mx-auto mb-4">
              1
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Upload WebP Images</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Drag and drop single or multiple WebP files into the uploader.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm text-center">
            <div className="h-12 w-12 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold text-lg mx-auto mb-4">
              2
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Configure JPG</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Adjust quality and choose a background color for any transparent pixels.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm text-center">
            <div className="h-12 w-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-lg mx-auto mb-4">
              3
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Download JPG</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Download your converted JPG images individually or as a complete ZIP bundle.
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
