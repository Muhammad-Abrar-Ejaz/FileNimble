import { toolMetadata } from '@/lib/seo';
import { ToolSeo } from '@/components/seo/PageSeo';
import { getToolBySlug } from '@/lib/registry';
import { SharedImageConverterClient } from '@/components/converter';
import { RelatedTools } from '@/components/tools/RelatedTools';
import { AdSlot } from '@/components/ads';
import { HelpCircle, AlertCircle } from 'lucide-react';

export const metadata = toolMetadata('jpg-to-png');

export default function JpgToPngPage() {
  const currentTool = getToolBySlug('jpg-to-png');


  const faqs = [
    {
      q: 'Does converting JPG to PNG add transparent backgrounds?',
      a: 'No. Original JPG files do not contain an alpha transparency channel. Converting a JPG to PNG produces an opaque PNG image; it cannot retroactively create transparent areas or restore transparency that was never there.',
    },
    {
      q: 'Does converting JPG to PNG improve image quality?',
      a: 'No. While PNG is a lossless format, converting a JPG to PNG cannot restore image detail, sharpness, or compression artifacts that were already discarded during original JPEG compression.',
    },
    {
      q: 'Are my images uploaded to FileNimble servers?',
      a: 'This conversion runs in your browser using HTML5 Canvas. FileNimble does not upload the selected image for this conversion.',
    },
    {
      q: 'Why convert JPG to PNG if quality does not increase?',
      a: 'PNG is ideal when you need to prevent further quality degradation during subsequent edits, when integrating images into graphics pipelines that require PNG input, or when preparing assets for overlays.',
    },
    {
      q: 'Can I convert multiple JPG images at once?',
      a: 'Yes. You can upload up to 20 images in batch mode. FileNimble processes them with memory-safe concurrency and provides a single ZIP download option.',
    },
  ];

  return (
    <div className="py-8 sm:py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-16">
      <ToolSeo slug="jpg-to-png" />

      <SharedImageConverterClient
        toolTitle="JPG to PNG Converter"
        toolDescription="Convert JPG/JPEG photos into lossless PNG format directly in your browser."
        sourceFormats={['jpg', 'jpeg']}
        targetFormat="png"
        targetMime="image/png"
        mode="convert"
      />

      <AdSlot placement="tool-after-converter" format="horizontal" tool={currentTool} />

      {/* Step-by-step Guide */}
      <section className="max-w-4xl mx-auto" aria-labelledby="how-to-convert-heading">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 id="how-to-convert-heading" className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            How to Convert JPG to PNG
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Convert your JPG images to PNG with lossless output encoding in three simple steps.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm flex flex-col items-center text-center">
            <div className="h-12 w-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-lg mb-4">
              1
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Upload JPG Images</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Drag & drop or select your JPG files. You can convert single images or batches up to 20 files.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm flex flex-col items-center text-center">
            <div className="h-12 w-12 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold text-lg mb-4">
              2
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Process in Browser</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Click Convert. FileNimble instantly re-encodes the image into standard lossless PNG pixels locally.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm flex flex-col items-center text-center">
            <div className="h-12 w-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-lg mb-4">
              3
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Download PNG</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Download your converted PNG files individually or bundle all files together as a single ZIP archive.
            </p>
          </div>
        </div>
      </section>

      {/* Important Transparency Notice */}
      <section className="max-w-4xl mx-auto rounded-2xl border border-amber-200 bg-amber-50/70 p-6 sm:p-8 dark:border-amber-900/50 dark:bg-amber-950/30">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-amber-100 p-2.5 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 shrink-0">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-amber-950 dark:text-amber-200">
              Transparency & Quality Considerations
            </h3>
            <p className="text-sm leading-relaxed text-amber-900 dark:text-amber-300">
              JPG is an inherently opaque format that discards transparency data upon compression. Converting a JPG
              file into PNG creates an <strong>opaque PNG</strong>. It does not generate a transparent background or
              restore image detail lost during original JPEG creation.
            </p>
          </div>
        </div>
      </section>

      {/* Format Comparison */}
      <section className="max-w-4xl mx-auto space-y-6">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight text-center">
          JPG vs PNG: Key Differences
        </h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-4">Feature</th>
                <th className="p-4">JPG (JPEG)</th>
                <th className="p-4">PNG</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              <tr>
                <td className="p-4 font-semibold">Compression Type</td>
                <td className="p-4">Lossy (discards visual data to save space)</td>
                <td className="p-4">Lossless (retains exact pixel data)</td>
              </tr>
              <tr>
                <td className="p-4 font-semibold">Transparency</td>
                <td className="p-4 text-rose-600 dark:text-rose-400 font-medium">Not supported</td>
                <td className="p-4 text-emerald-600 dark:text-emerald-400 font-medium">Supported (Alpha channel)</td>
              </tr>
              <tr>
                <td className="p-4 font-semibold">Typical File Size</td>
                <td className="p-4">Very small (ideal for photos and web)</td>
                <td className="p-4">Larger (ideal for graphics and text)</td>
              </tr>
              <tr>
                <td className="p-4 font-semibold">Best Use Case</td>
                <td className="p-4">Digital photography and general web images</td>
                <td className="p-4">Logos, screenshots, charts, graphics</td>
              </tr>
            </tbody>
          </table>
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
