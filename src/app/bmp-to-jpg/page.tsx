import { toolMetadata } from '@/lib/seo';
import { ToolPageSeo } from '@/components/seo/PageSeo';
import { getToolBySlug } from '@/lib/registry';
import { SharedImageConverterClient } from '@/components/converter';
import { RelatedTools } from '@/components/tools/RelatedTools';
import { AdSlot } from '@/components/ads';
import { HelpCircle, AlertCircle } from 'lucide-react';

export const metadata = toolMetadata('bmp-to-jpg');

export default function BmpToJpgPage() {
  const currentTool = getToolBySlug('bmp-to-jpg');

  const faqs = [
    {
      q: 'Why should I convert BMP to JPG?',
      a: 'BMP files are uncompressed bitmap graphics that produce huge file sizes. Converting BMP to JPG drastically reduces file size by 80% to 95%, making them suitable for web sharing, email attachments, and storage.',
    },
    {
      q: 'Are my BMP images uploaded to a server?',
      a: 'No. Conversion runs locally in your browser using HTML5 Canvas. Your images are never sent over the network.',
    },
    {
      q: 'Can I convert multiple BMP images at once?',
      a: 'Yes. You can select up to 20 BMP images and convert them simultaneously, with single-click individual downloads or a bundled ZIP archive.',
    },
    {
      q: 'What happens to transparency when converting BMP to JPG?',
      a: 'JPEG is an opaque format that does not support alpha channels. Transparent areas or alpha masks in BMP files will be filled with your selected background color (white by default).',
    },
  ];

  return (
    <div className="py-8 sm:py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-16">
      <ToolPageSeo slug="bmp-to-jpg" />

      <SharedImageConverterClient
        toolTitle="BMP to JPG Converter"
        toolDescription="Convert uncompressed Windows BMP bitmap images to lightweight, web-ready JPG format directly in your browser."
        sourceFormats={['bmp']}
        targetFormat="jpg"
        targetMime="image/jpeg"
        mode="convert"
        showBackgroundOption={true}
      />

      <AdSlot placement="tool-after-converter" format="horizontal" tool={currentTool} />

      {/* Step-by-step Guide */}
      <section className="max-w-4xl mx-auto" aria-labelledby="how-to-convert-heading">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 id="how-to-convert-heading" className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            How to Convert BMP to JPG
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Convert large bitmap images into compressed JPEG files in three easy steps.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm flex flex-col items-center text-center">
            <div className="h-12 w-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-lg mb-4">
              1
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Upload BMP Images</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Drag & drop or select your BMP files. You can convert single images or batches up to 20 files.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm flex flex-col items-center text-center">
            <div className="h-12 w-12 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold text-lg mb-4">
              2
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Set Quality & Color</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Select your preferred JPEG quality and solid background color, then click Convert to JPG.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm flex flex-col items-center text-center">
            <div className="h-12 w-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-lg mb-4">
              3
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Download JPG</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Download your converted JPEG files individually or bundle all files together as a single ZIP archive.
            </p>
          </div>
        </div>
      </section>

      {/* Notice */}
      <section className="max-w-4xl mx-auto rounded-2xl border border-amber-200 bg-amber-50/70 p-6 sm:p-8 dark:border-amber-900/50 dark:bg-amber-950/30">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-amber-100 p-2.5 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 shrink-0">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-amber-950 dark:text-amber-200">
              File Size & Compression Notice
            </h3>
            <p className="text-sm leading-relaxed text-amber-900 dark:text-amber-300">
              BMP files store raw pixel arrays without compression. Converting to JPG applies lossy perceptual compression,
              reducing file size significantly while retaining high visual fidelity.
            </p>
          </div>
        </div>
      </section>

      {/* Format Comparison */}
      <section className="max-w-4xl mx-auto space-y-6">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight text-center">
          BMP vs JPG: Key Differences
        </h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-4">Feature</th>
                <th className="p-4">BMP (Bitmap)</th>
                <th className="p-4">JPG (JPEG)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              <tr>
                <td className="p-4 font-semibold">Compression</td>
                <td className="p-4">Uncompressed / Raw</td>
                <td className="p-4">Lossy (compact size)</td>
              </tr>
              <tr>
                <td className="p-4 font-semibold">File Size</td>
                <td className="p-4 text-rose-600 dark:text-rose-400 font-medium">Very large (megabytes per image)</td>
                <td className="p-4 text-emerald-600 dark:text-emerald-400 font-medium">Lightweight (kilobytes)</td>
              </tr>
              <tr>
                <td className="p-4 font-semibold">Web Compatibility</td>
                <td className="p-4">Poor (not recommended for web)</td>
                <td className="p-4">Universal standard</td>
              </tr>
              <tr>
                <td className="p-4 font-semibold">Best Use Case</td>
                <td className="p-4">Legacy Windows software & desktop wallpaper</td>
                <td className="p-4">Digital photography and web publication</td>
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
