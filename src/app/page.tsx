import { pageMetadata } from '@/lib/seo';
import { siteConfig } from '@/config/site';
import { JsonLd } from '@/components/seo/PageSeo';
import { canonicalUrl } from '@/lib/seo';
import React from "react";
import { getAllTools } from "@/lib/registry";
import { UniversalUploader } from "@/components/uploader/UniversalUploader";
import { ToolSearch } from "@/components/tools/ToolSearch";
import { CategoryGrid } from "@/components/tools/CategoryGrid";
import { ToolCard } from "@/components/tools/ToolCard";
import { AdSlot } from "@/components/ads";
import {
  ShieldCheck,
  Zap,
  Lock,
  Layers,
  Sparkles,
  ArrowRight,
  FileCheck2,
  Sliders,
  Download,
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
      <section className="relative overflow-hidden pt-12 pb-16 sm:pt-20 sm:pb-24 bg-gradient-to-b from-surface via-background-app to-background-app border-b border-border-subtle/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            {/* Top pill badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-6 border border-primary/20">
              <Sparkles size={14} className="animate-pulse" aria-hidden="true" />
              <span>Next-Generation Online Converter</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-text-strong tracking-tight leading-[1.1]">
              Any file. <span className="text-primary">Right format.</span>
            </h1>

            <p className="mt-5 text-base sm:text-lg text-text-muted leading-relaxed max-w-2xl mx-auto">
              Convert images, organize PDF pages, and transform supported documents or data. Check each tool’s processing label and limits; converters outside the current release remain marked planned.
            </p>

            {/* Quick feature pill row */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-xs font-medium text-text-muted">
              <span className="flex items-center gap-1.5">
                <ShieldCheck size={15} className="text-emerald-600" aria-hidden="true" />
                Clear processing labels
              </span>
              <span className="text-border-subtle">•</span>
              <span className="flex items-center gap-1.5">
                <Zap size={15} className="text-amber-500" aria-hidden="true" />
                Lightning Fast
              </span>
              <span className="text-border-subtle">•</span>
              <span className="flex items-center gap-1.5">
                <Lock size={15} className="text-blue-600" aria-hidden="true" />
                100% Free & No Sign-up
              </span>
            </div>
          </div>

          {/* Universal Dropzone Preview (Phase 0/1 UI Foundation) */}
          <div className="mt-10 sm:mt-12">
            <UniversalUploader
              title="Drop files here to inspect & validate"
              subtitle="Universal FileNimble dropzone — select any document, image, or archive to test validation"
              privacyLabel="Files are validated locally in your browser. Choose a live tool below to convert."
            />
          </div>
        </div>
      </section>

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
              No complicated settings, registration forms, or waiting queues.
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
                Choose output format, adjust quality or compression level, and click Convert. Check each tool’s processing label before selecting files.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-background-app border border-border-subtle relative text-center sm:text-left">
              <div className="w-12 h-12 rounded-xl bg-primary text-white font-bold text-lg flex items-center justify-center mb-4 mx-auto sm:mx-0 shadow-xs">
                3
              </div>
              <h3 className="text-base font-bold text-text-strong flex items-center gap-2 justify-center sm:justify-start">
                <Download size={18} className="text-primary" aria-hidden="true" />
                Instant Download
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-text-muted leading-relaxed">
                Download your converted file or multi-file ZIP archive immediately. Files are never stored or tracked.
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
              <span>Privacy-First Architecture</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-text-strong tracking-tight">
              Your files belong to you. Always.
            </h2>
            <p className="mt-3 text-sm text-text-muted leading-relaxed">
              Tools labelled Runs in browser keep file content on your device. OCR and supported document tools use temporary server processing. Each tool explains its limits before conversion; read our privacy policy for retention and cleanup details.
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
