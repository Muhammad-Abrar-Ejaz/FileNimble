import { toolMetadata } from '@/lib/seo';
import { ToolSeo } from '@/components/seo/PageSeo';
import { getToolBySlug } from "@/lib/registry";
import { PngToJpgConverterClient } from "@/components/converter/PngToJpgConverterClient";
import { RelatedTools } from "@/components/tools/RelatedTools";
import { AdSlot } from "@/components/ads";
import {
  Sliders,
  Download,
  HelpCircle,
  FileCheck2,
  AlertCircle,
  Sparkles,
} from "lucide-react";

export const metadata = toolMetadata('png-to-jpg');

export default function PngToJpgPage() {
  const currentTool = getToolBySlug("png-to-jpg");


  const faqs = [
    {
      q: "Is PNG to JPG conversion free on FileNimble?",
      a: "Yes, 100% free. There are no daily limits, watermarks, or paid subscriptions required to convert your images.",
    },
    {
      q: "Are my PNG files uploaded to your servers?",
      a: "No. This conversion runs in your browser using HTML5 Canvas and createImageBitmap. FileNimble does not upload the selected image for this conversion.",
    },
    {
      q: "What happens to transparent PNG backgrounds?",
      a: "JPEG is a format that does not support transparency (alpha channels). FileNimble lets you select a solid background color (white by default, black, or any custom color) to replace transparent pixels cleanly before encoding.",
    },
    {
      q: "Can I convert multiple PNG files at once?",
      a: "Yes. You can select or drop up to 20 PNG images at once. FileNimble processes them with client-side concurrency and gives you individual download buttons plus a 'Download All as ZIP' option.",
    },
    {
      q: "Can I choose the JPG compression quality?",
      a: "Yes. Use the quality slider to adjust output compression from 10% to 100%. The recommended default is 85%, which produces great visual fidelity while reducing file size significantly.",
    },
    {
      q: "Does converting PNG to JPG reduce image quality?",
      a: "PNG uses lossless compression, whereas JPG is a lossy compression format. While converting reduces file size, setting the quality to 85%–95% preserves virtually identical visual appearance for everyday photos, web graphics, and screenshots.",
    },
  ];

  return (
    <div className="py-8 sm:py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-16">
      <ToolSeo slug="png-to-jpg" />
      {/* Schema.org Structured Data */}

      {/* 1. Core Converter Component */}
      <PngToJpgConverterClient />

      <AdSlot placement="tool-after-converter" format="horizontal" tool={currentTool} />

      {/* 2. Step-by-Step Guide */}
      <section className="max-w-4xl mx-auto" aria-labelledby="how-to-convert-heading">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 id="how-to-convert-heading" className="text-2xl font-bold text-text-strong tracking-tight">
            How to Convert PNG to JPG Online
          </h2>
          <p className="mt-2 text-sm text-text-muted">
            Three simple steps to transform your PNG images with complete privacy.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-surface border border-border-subtle shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary font-bold text-sm flex items-center justify-center mb-4">
              1
            </div>
            <h3 className="text-sm font-bold text-text-strong flex items-center gap-1.5">
              <FileCheck2 size={16} className="text-primary" />
              Upload PNG Files
            </h3>
            <p className="mt-2 text-xs text-text-muted leading-relaxed">
              Drag and drop one or multiple PNG images into the uploader, or click Choose Files from your computer or phone.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-surface border border-border-subtle shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary font-bold text-sm flex items-center justify-center mb-4">
              2
            </div>
            <h3 className="text-sm font-bold text-text-strong flex items-center gap-1.5">
              <Sliders size={16} className="text-primary" />
              Configure Options
            </h3>
            <p className="mt-2 text-xs text-text-muted leading-relaxed">
              Select your preferred JPG quality (85% recommended) and pick a background color to flatten transparent areas.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-surface border border-border-subtle shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary font-bold text-sm flex items-center justify-center mb-4">
              3
            </div>
            <h3 className="text-sm font-bold text-text-strong flex items-center gap-1.5">
              <Download size={16} className="text-primary" />
              Convert & Download
            </h3>
            <p className="mt-2 text-xs text-text-muted leading-relaxed">
              Click Convert to JPG to generate your files instantly. Download each JPG individually or save all in a single ZIP file.
            </p>
          </div>
        </div>
      </section>

      {/* 3. PNG vs JPG Comparison & Transparency Note */}
      <section className="max-w-4xl mx-auto space-y-8" aria-labelledby="png-vs-jpg-heading">
        <div className="p-6 sm:p-8 rounded-3xl bg-surface border border-border-subtle shadow-xs space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 id="png-vs-jpg-heading" className="text-xl font-bold text-text-strong">
                PNG vs JPG: Key Differences
              </h2>
              <p className="text-xs text-text-muted">
                Understanding format tradeoffs helps you pick the right format for every task.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border-subtle text-text-strong font-semibold">
                  <th className="py-2.5 px-3">Feature</th>
                  <th className="py-2.5 px-3 bg-amber-50/50 rounded-t-lg">PNG (Portable Network Graphics)</th>
                  <th className="py-2.5 px-3 bg-primary/5 rounded-t-lg">JPG / JPEG</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle text-text-muted">
                <tr>
                  <td className="py-2.5 px-3 font-medium text-text-strong">Compression</td>
                  <td className="py-2.5 px-3 bg-amber-50/20">Lossless (no quality degradation)</td>
                  <td className="py-2.5 px-3 bg-primary/2">Lossy (adjustable compression ratio)</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-medium text-text-strong">Transparency</td>
                  <td className="py-2.5 px-3 bg-amber-50/20">Supports alpha channel transparency</td>
                  <td className="py-2.5 px-3 bg-primary/2">No transparency support (solid background required)</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-medium text-text-strong">Typical File Size</td>
                  <td className="py-2.5 px-3 bg-amber-50/20">Larger (especially for complex photographs)</td>
                  <td className="py-2.5 px-3 bg-primary/2">Significantly smaller (ideal for websites & emails)</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-medium text-text-strong">Best For</td>
                  <td className="py-2.5 px-3 bg-amber-50/20">Logos, screenshots, UI icons, sharp diagrams</td>
                  <td className="py-2.5 px-3 bg-primary/2">Photographs, digital art, social media uploads</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Transparency Warning Callout */}
          <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900 flex items-start gap-3">
            <AlertCircle size={18} className="shrink-0 text-amber-600 mt-0.5" />
            <div>
              <p className="font-bold">Important note regarding transparency in JPG files:</p>
              <p className="mt-0.5 leading-relaxed text-amber-800">
                Because the JPEG specification cannot store transparent pixels, transparent areas in your PNG image will be automatically filled with your chosen background color (default is pure white). If you require background transparency for web design, keep your files in PNG or convert them to WebP.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Frequently Asked Questions */}
      <section className="max-w-4xl mx-auto" aria-labelledby="faq-heading">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary mb-2">
            <HelpCircle size={14} />
            <span>Got Questions?</span>
          </div>
          <h2 id="faq-heading" className="text-2xl font-bold text-text-strong tracking-tight">
            Frequently Asked Questions
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            Everything you need to know about our browser-based PNG to JPG converter.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className="p-6 rounded-2xl bg-surface border border-border-subtle shadow-xs flex flex-col justify-between"
            >
              <h3 className="text-sm font-bold text-text-strong">{faq.q}</h3>
              <p className="mt-2 text-xs text-text-muted leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 5. Related Tools Section */}
      {currentTool && (
        <div className="max-w-4xl mx-auto pt-4 border-t border-border-subtle">
          <RelatedTools tool={currentTool} limit={4} title="More Image & Document Tools" />
        </div>
      )}
    </div>
  );
}
