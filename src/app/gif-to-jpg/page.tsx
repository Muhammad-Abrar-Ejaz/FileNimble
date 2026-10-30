import { toolMetadata } from '@/lib/seo';
import { ToolPageSeo } from '@/components/seo/PageSeo';
import { getToolBySlug } from '@/lib/registry';
import { SharedImageConverterClient } from '@/components/converter';
import { RelatedTools } from '@/components/tools/RelatedTools';
import { AdSlot } from '@/components/ads';
import { HelpCircle, AlertCircle } from 'lucide-react';

export const metadata = toolMetadata('gif-to-jpg');

export default function GifToJpgPage() {
  const currentTool = getToolBySlug('gif-to-jpg');

  const faqs = [
    {
      q: 'Does converting GIF to JPG retain animation?',
      a: 'No. JPEG is a static image format. Converting an animated GIF captures and saves the first frame as a high-quality static JPEG.',
    },
    {
      q: 'What happens to transparent GIF areas?',
      a: 'JPEG does not support transparency. Transparent areas in your GIF are automatically filled with your chosen background color (white by default).',
    },
    {
      q: 'Is GIF to JPG conversion private?',
      a: 'Yes. All processing happens entirely within your web browser using HTML5 Canvas. Your files are not uploaded.',
    },
    {
      q: 'Can I convert multiple GIF files at once?',
      a: 'Yes. You can upload up to 20 GIF files at once, adjust quality and background options, and download all as a ZIP archive.',
    },
  ];

  return (
    <div className="py-8 sm:py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-16">
      <ToolPageSeo slug="gif-to-jpg" />

      <SharedImageConverterClient
        toolTitle="GIF to JPG Converter"
        toolDescription="Convert GIF images and animations to compressed JPEG format in your browser."
        sourceFormats={['gif']}
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
            How to Convert GIF to JPG
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Convert GIF images into optimized JPEG photos in three simple steps.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm flex flex-col items-center text-center">
            <div className="h-12 w-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-lg mb-4">
              1
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Upload GIF Files</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Select or drop your GIF files. You can convert single images or batches up to 20 files.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm flex flex-col items-center text-center">
            <div className="h-12 w-12 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold text-lg mb-4">
              2
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Configure Background & Quality</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Pick a background color for transparent pixels, adjust quality slider, and click Convert to JPG.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm flex flex-col items-center text-center">
            <div className="h-12 w-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-lg mb-4">
              3
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Download JPG</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Download your converted JPEG files individually or download all images as a single ZIP.
            </p>
          </div>
        </div>
      </section>

      {/* Animation & Transparency Notice */}
      <section className="max-w-4xl mx-auto rounded-2xl border border-amber-200 bg-amber-50/70 p-6 sm:p-8 dark:border-amber-900/50 dark:bg-amber-950/30">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-amber-100 p-2.5 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 shrink-0">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-amber-950 dark:text-amber-200">
              Static Image Notice
            </h3>
            <p className="text-sm leading-relaxed text-amber-900 dark:text-amber-300">
              JPEG is a still photographic format and cannot play animations. When converting animated GIFs, the primary frame
              is extracted and saved as an image. Transparent GIF areas are filled with your chosen solid background color.
            </p>
          </div>
        </div>
      </section>

      {/* Format Comparison */}
      <section className="max-w-4xl mx-auto space-y-6">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight text-center">
          GIF vs JPG: Key Differences
        </h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-4">Feature</th>
                <th className="p-4">GIF</th>
                <th className="p-4">JPG (JPEG)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              <tr>
                <td className="p-4 font-semibold">Color Depth</td>
                <td className="p-4">8-bit (up to 256 colors)</td>
                <td className="p-4">24-bit (16.7 million colors)</td>
              </tr>
              <tr>
                <td className="p-4 font-semibold">Animation</td>
                <td className="p-4 text-emerald-600 dark:text-emerald-400 font-medium">Supported</td>
                <td className="p-4 text-rose-600 dark:text-rose-400 font-medium">Not supported (still frame only)</td>
              </tr>
              <tr>
                <td className="p-4 font-semibold">Transparency</td>
                <td className="p-4">1-bit index transparency</td>
                <td className="p-4">No transparency (solid background)</td>
              </tr>
              <tr>
                <td className="p-4 font-semibold">Best Use Case</td>
                <td className="p-4">Simple clips and retro graphics</td>
                <td className="p-4">Photographs and continuous-tone images</td>
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
