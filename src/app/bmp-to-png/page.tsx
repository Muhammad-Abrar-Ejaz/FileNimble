import { toolMetadata } from '@/lib/seo';
import { ToolPageSeo } from '@/components/seo/PageSeo';
import { getToolBySlug } from '@/lib/registry';
import { SharedImageConverterClient } from '@/components/converter';
import { RelatedTools } from '@/components/tools/RelatedTools';
import { AdSlot } from '@/components/ads';
import { HelpCircle, ShieldCheck } from 'lucide-react';

export const metadata = toolMetadata('bmp-to-png');

export default function BmpToPngPage() {
  const currentTool = getToolBySlug('bmp-to-png');

  const faqs = [
    {
      q: 'Does converting BMP to PNG lose quality?',
      a: 'No. Both BMP and PNG are lossless formats. PNG uses Deflate compression to reduce file size without discarding any pixel data.',
    },
    {
      q: 'Are my files uploaded to FileNimble?',
      a: 'No. All image decoding and PNG encoding are performed client-side in your web browser.',
    },
    {
      q: 'Can I batch convert BMP files?',
      a: 'Yes. FileNimble lets you convert up to 20 BMP files at once and export them as a single ZIP archive.',
    },
    {
      q: 'Why should I convert BMP to PNG?',
      a: 'PNG is supported by all modern web browsers and image viewers, and provides lossless compression that can reduce file size by 50% to 70% compared to raw uncompressed BMP.',
    },
  ];

  return (
    <div className="py-8 sm:py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-16">
      <ToolPageSeo slug="bmp-to-png" />

      <SharedImageConverterClient
        toolTitle="BMP to PNG Converter"
        toolDescription="Convert legacy BMP bitmap images into modern, lossless PNG format directly in your browser."
        sourceFormats={['bmp']}
        targetFormat="png"
        targetMime="image/png"
        mode="convert"
      />

      <AdSlot placement="tool-after-converter" format="horizontal" tool={currentTool} />

      {/* Step-by-step Guide */}
      <section className="max-w-4xl mx-auto" aria-labelledby="how-to-convert-heading">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 id="how-to-convert-heading" className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            How to Convert BMP to PNG
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Convert BMP bitmaps to lossless PNG format in three simple steps.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm flex flex-col items-center text-center">
            <div className="h-12 w-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-lg mb-4">
              1
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Upload BMP Files</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Drag & drop or select your BMP files. Single images or batches up to 20 files are supported.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm flex flex-col items-center text-center">
            <div className="h-12 w-12 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold text-lg mb-4">
              2
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Convert to PNG</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Click Convert. FileNimble decodes the bitmap and re-encodes it into lossless PNG locally.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm flex flex-col items-center text-center">
            <div className="h-12 w-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-lg mb-4">
              3
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Download PNG</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Download your converted PNG files individually or bundle all files together as a ZIP.
            </p>
          </div>
        </div>
      </section>

      {/* Quality Benefit Notice */}
      <section className="max-w-4xl mx-auto rounded-2xl border border-emerald-200 bg-emerald-50/70 p-6 sm:p-8 dark:border-emerald-900/50 dark:bg-emerald-950/30">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-emerald-100 p-2.5 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 shrink-0">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-emerald-950 dark:text-emerald-200">
              Lossless Conversion Guarantee
            </h3>
            <p className="text-sm leading-relaxed text-emerald-900 dark:text-emerald-300">
              Converting BMP to PNG does not alter or compress pixels with lossy artifacts. Every color value and
              pixel coordinate is preserved with 100% mathematical fidelity.
            </p>
          </div>
        </div>
      </section>

      {/* Format Comparison */}
      <section className="max-w-4xl mx-auto space-y-6">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight text-center">
          BMP vs PNG: Key Differences
        </h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-4">Feature</th>
                <th className="p-4">BMP (Bitmap)</th>
                <th className="p-4">PNG</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              <tr>
                <td className="p-4 font-semibold">Compression</td>
                <td className="p-4">Uncompressed</td>
                <td className="p-4">Lossless Deflate</td>
              </tr>
              <tr>
                <td className="p-4 font-semibold">File Size</td>
                <td className="p-4 text-rose-600 dark:text-rose-400 font-medium">Very large</td>
                <td className="p-4 text-emerald-600 dark:text-emerald-400 font-medium">Optimized / Compact</td>
              </tr>
              <tr>
                <td className="p-4 font-semibold">Transparency</td>
                <td className="p-4">Limited / Non-standard</td>
                <td className="p-4 text-emerald-600 dark:text-emerald-400 font-medium">Full Alpha Channel</td>
              </tr>
              <tr>
                <td className="p-4 font-semibold">Best Use Case</td>
                <td className="p-4">Legacy software</td>
                <td className="p-4">Modern web, UI graphics, screenshots</td>
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
