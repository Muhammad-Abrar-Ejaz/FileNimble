import { toolMetadata } from '@/lib/seo';
import { ToolPageSeo } from '@/components/seo/PageSeo';
import { getToolBySlug } from '@/lib/registry';
import { SharedImageConverterClient } from '@/components/converter';
import { RelatedTools } from '@/components/tools/RelatedTools';
import { AdSlot } from '@/components/ads';
import { HelpCircle, Sparkles } from 'lucide-react';

export const metadata = toolMetadata('gif-to-png');

export default function GifToPngPage() {
  const currentTool = getToolBySlug('gif-to-png');

  const faqs = [
    {
      q: 'Does GIF to PNG conversion preserve transparency?',
      a: 'Yes. Transparent pixels in the original GIF are mapped directly to the PNG alpha channel, maintaining full transparency without jagged fringing.',
    },
    {
      q: 'Does this convert animated GIFs to animated PNGs (APNG)?',
      a: 'No. FileNimble converts the primary still frame of the GIF into a standard, widely compatible static PNG image.',
    },
    {
      q: 'Are my GIF files uploaded to a server?',
      a: 'No. Processing is 100% client-side in your browser; no images are uploaded to any server.',
    },
    {
      q: 'Why convert GIF to PNG?',
      a: 'PNG supports full 24-bit RGB and 32-bit RGBA color spaces, compared to GIF’s 256-color limit. Converting GIF to PNG provides a modern, lossless asset ready for graphics editing and crisp UI presentation.',
    },
  ];

  return (
    <div className="py-8 sm:py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-16">
      <ToolPageSeo slug="gif-to-png" />

      <SharedImageConverterClient
        toolTitle="GIF to PNG Converter"
        toolDescription="Convert 256-color GIF images into crisp 24-bit PNG images with full alpha channel support in your browser."
        sourceFormats={['gif']}
        targetFormat="png"
        targetMime="image/png"
        mode="convert"
      />

      <AdSlot placement="tool-after-converter" format="horizontal" tool={currentTool} />

      {/* Step-by-step Guide */}
      <section className="max-w-4xl mx-auto" aria-labelledby="how-to-convert-heading">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 id="how-to-convert-heading" className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            How to Convert GIF to PNG
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Convert GIF images into transparent PNG graphics in three simple steps.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm flex flex-col items-center text-center">
            <div className="h-12 w-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-lg mb-4">
              1
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Upload GIF Files</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Drag & drop or select your GIF files. Batch convert up to 20 images at once.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm flex flex-col items-center text-center">
            <div className="h-12 w-12 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold text-lg mb-4">
              2
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Convert to PNG</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Click Convert. FileNimble decodes GIF pixels and encodes clean PNG format with transparency.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm flex flex-col items-center text-center">
            <div className="h-12 w-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-lg mb-4">
              3
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Download PNG</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Download your converted PNG files individually or bundle all files together as a single ZIP.
            </p>
          </div>
        </div>
      </section>

      {/* Alpha Transparency Highlight */}
      <section className="max-w-4xl mx-auto rounded-2xl border border-indigo-200 bg-indigo-50/70 p-6 sm:p-8 dark:border-indigo-900/50 dark:bg-indigo-950/30">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-indigo-100 p-2.5 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 shrink-0">
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-indigo-950 dark:text-indigo-200">
              Full Alpha Transparency Support
            </h3>
            <p className="text-sm leading-relaxed text-indigo-900 dark:text-indigo-300">
              While GIF only supports 1-bit on/off transparency, converting to PNG outputs a complete 8-bit alpha channel,
              enabling clean blending on any web background or dark mode theme.
            </p>
          </div>
        </div>
      </section>

      {/* Format Comparison */}
      <section className="max-w-4xl mx-auto space-y-6">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight text-center">
          GIF vs PNG: Key Differences
        </h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-4">Feature</th>
                <th className="p-4">GIF</th>
                <th className="p-4">PNG</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              <tr>
                <td className="p-4 font-semibold">Max Colors</td>
                <td className="p-4">256 colors (indexed palette)</td>
                <td className="p-4 text-emerald-600 dark:text-emerald-400 font-medium">16.7 million colors (Truecolor)</td>
              </tr>
              <tr>
                <td className="p-4 font-semibold">Transparency Type</td>
                <td className="p-4">1-bit binary transparency</td>
                <td className="p-4 text-emerald-600 dark:text-emerald-400 font-medium">Full 8-bit alpha channel</td>
              </tr>
              <tr>
                <td className="p-4 font-semibold">Compression Type</td>
                <td className="p-4">LZW compression</td>
                <td className="p-4">Deflate (higher compression efficiency)</td>
              </tr>
              <tr>
                <td className="p-4 font-semibold">Best Use Case</td>
                <td className="p-4">Retro animations & memes</td>
                <td className="p-4">Logos, web graphics, UI elements, overlays</td>
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
