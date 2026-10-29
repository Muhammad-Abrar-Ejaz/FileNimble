import { pageMetadata } from '@/lib/seo';
import { siteConfig } from '@/config/site';
import { JsonLd } from '@/components/seo/PageSeo';
import { canonicalUrl } from '@/lib/seo';
import React from "react";
import { getAllTools } from "@/lib/registry";
import { ToolSearch } from "@/components/tools/ToolSearch";
import { CategoryGrid } from "@/components/tools/CategoryGrid";
import { ToolCard } from "@/components/tools/ToolCard";
import { AdSlot } from "@/components/ads";
import { MonochromeStatsHero } from "@/components/home/MonochromeStatsHero";
import {
  ShieldCheck,
  Layers,
  Sparkles,
  ArrowRight,
  FileCheck2,
  Sliders,
  Download,
  Lock,
} from "lucide-react";

export const metadata = pageMetadata('/', 'FileNimble — Any file. Right format.', siteConfig.description);

export default function HomePage() {
  const allTools = getAllTools();

  // Featured sample tools for homepage showcase (first 8 high-utility tools)
  const featuredTools = allTools.slice(0, 8);

  return (
    <div className="flex flex-col min-h-screen">
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'WebSite', name: 'FileNimble', url: canonicalUrl('/') }} />
      {/* 1. Hero Section */}
      <MonochromeStatsHero
        description="Convert images, organize PDF pages, and transform supported documents or data. Use ready browser tools for supported local conversions, or convert TAR to ZIP and ZIP to TAR with temporary server processing. Tools marked Planned are not available in this release; each available tool lists its processing method and limits."
      />

      {/* Optional Ad slot after hero */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <AdSlot placement="home-after-hero" format="horizontal" />
      </div>

      {/* 2. Tool Search Section */}
      <section id="search" className="py-16 sm:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full scroll-mt-20">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-text-strong tracking-tight">
            Find the Exact Tool You Need
          </h2>
          <p className="mt-2 text-sm text-text-muted">
            Search our comprehensive registry of over 130 conversion utilities and document tools.
          </p>
        </div>

        <ToolSearch initialTools={allTools} maxResults={12} />
      </section>

      {/* 3. Browse by Category Grid */}
      <section id="categories" className="py-16 sm:py-20 bg-surface border-y border-border-subtle/80 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-10 gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary mb-2">
                <Layers size={14} aria-hidden="true" />
                <span>Categories</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-text-strong tracking-tight">
                Explore Conversion Families
              </h2>
              <p className="mt-1 text-sm text-text-muted">
                From PDF documents and raster images to audio tracks and structured data.
              </p>
            </div>
            <a
              href="#search"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline self-start sm:self-auto"
            >
              <span>View all tools</span>
              <ArrowRight size={13} aria-hidden="true" />
            </a>
          </div>

          <CategoryGrid tools={allTools} />
        </div>
      </section>

      {/* 4. Popular Tools Section */}
      <section className="py-16 sm:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary mb-2">
              <Sparkles size={14} aria-hidden="true" />
              <span>Catalog Highlights</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-text-strong tracking-tight">
              Featured Tools
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              Explore planned and live capabilities from our typed registry.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {featuredTools.map((tool) => (
            <ToolCard key={tool.id} tool={tool} />
          ))}
        </div>
      </section>

      {/* Optional Ad slot between major editorial sections */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <AdSlot placement="home-between-sections" format="horizontal" />
      </div>

      {/* 5. How It Works Section */}
      <section className="py-16 sm:py-20 bg-surface border-y border-border-subtle/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-text-strong tracking-tight">
              Simple 3-Step Workflow
            </h2>
            <p className="mt-2 text-sm text-text-muted">
              Choose a ready tool and follow its format and size limits. Server-based TAR ↔ ZIP jobs use a limited queue and may ask you to retry when capacity is full.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 rounded-2xl bg-background-app border border-border-subtle relative text-center sm:text-left">
              <div className="w-12 h-12 rounded-xl bg-primary text-white font-bold text-lg flex items-center justify-center mb-4 mx-auto sm:mx-0 shadow-xs">
                1
              </div>
              <h3 className="text-base font-bold text-text-strong flex items-center gap-2 justify-center sm:justify-start">
                <FileCheck2 size={18} className="text-primary" aria-hidden="true" />
                Select or Drop Files
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-text-muted leading-relaxed">
                Open a live tool, then drag and drop your files or browse from your device. File headers and limits are checked before conversion.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-background-app border border-border-subtle relative text-center sm:text-left">
              <div className="w-12 h-12 rounded-xl bg-primary text-white font-bold text-lg flex items-center justify-center mb-4 mx-auto sm:mx-0 shadow-xs">
                2
              </div>
              <h3 className="text-base font-bold text-text-strong flex items-center gap-2 justify-center sm:justify-start">
                <Sliders size={18} className="text-primary" aria-hidden="true" />
                Configure & Process
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-text-muted leading-relaxed">
                Follow the selected tool’s options and processing label, then start the conversion when you are ready.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-background-app border border-border-subtle relative text-center sm:text-left">
              <div className="w-12 h-12 rounded-xl bg-primary text-white font-bold text-lg flex items-center justify-center mb-4 mx-auto sm:mx-0 shadow-xs">
                3
              </div>
              <h3 className="text-base font-bold text-text-strong flex items-center gap-2 justify-center sm:justify-start">
                <Download size={18} className="text-primary" aria-hidden="true" />
                Download When Ready
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-text-muted leading-relaxed">
                Download the result when processing finishes. TAR ↔ ZIP uses temporary server storage: abandoned jobs expire one hour after creation, completed outputs one hour after completion, and service outages can delay cleanup. Minimal job records are scheduled for removal seven days after confirmed file cleanup; delays may extend that period. See the Privacy policy for details.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Privacy & Security Trust Section */}
      <section className="py-16 sm:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-br from-primary/5 via-surface to-emerald-50/30 border border-primary/20 shadow-xs text-center sm:text-left">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold mb-4 border border-emerald-200">
              <ShieldCheck size={14} className="text-emerald-700" aria-hidden="true" />
              <span>Know Where Processing Happens</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-text-strong tracking-tight">
              Your files belong to you. Always.
            </h2>
            <p className="mt-3 text-sm text-text-muted leading-relaxed">
              Tools labelled Runs in browser process file content on your device. The only server conversions available in this release are TAR to ZIP and ZIP to TAR; they use temporary storage and a limited worker queue. OCR, AI and other tools marked Planned cannot process files in this release. Read our Privacy policy for expiry and cleanup details.
            </p>
            <div className="mt-6 flex flex-wrap gap-4 text-xs font-semibold text-text-strong">
              <div className="flex items-center gap-1.5 bg-surface px-3 py-2 rounded-xl border border-border-subtle shadow-2xs">
                <ShieldCheck size={16} className="text-emerald-600" />
                <span>Zero telemetry on file contents</span>
              </div>
              <div className="flex items-center gap-1.5 bg-surface px-3 py-2 rounded-xl border border-border-subtle shadow-2xs">
                <Lock size={16} className="text-blue-600" />
                <span>Processing labels on every tool</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

