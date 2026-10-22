import React from "react";
import {
  Sparkles,
  ArrowDown,
  Search,
  Layers,
  Lock,
  ShieldCheck,
  Tag,
} from "lucide-react";
import { GlyphMatrixBackground } from "./GlyphMatrixBackground";

interface MonochromeStatsHeroProps {
  children?: React.ReactNode;
  description?: string;
}

const DEFAULT_DESCRIPTION =
  "Convert images, organize PDF pages, and transform supported documents or data. Use ready browser tools for supported local conversions, or convert TAR to ZIP and ZIP to TAR with temporary server processing. Tools marked Planned are not available in this release; each available tool lists its processing method and limits.";

const STATS = [
  {
    value: "130+",
    label: "Conversion Tools",
    detail: "Comprehensive format registry",
    icon: Layers,
  },
  {
    value: "100% Free",
    label: "No Sign-Up",
    detail: "Immediate access, no account required",
    icon: Lock,
  },
  {
    value: "Zero Storage",
    label: "Private by Design",
    detail: "Local browser & ephemeral server tasks",
    icon: ShieldCheck,
  },
  {
    value: "Clear Labels",
    label: "Processing Transparency",
    detail: "Execution environment marked on every tool",
    icon: Tag,
  },
];

export function MonochromeStatsHero({
  children,
  description = DEFAULT_DESCRIPTION,
}: MonochromeStatsHeroProps) {
  return (
    <section className="relative overflow-hidden pt-12 pb-16 sm:pt-20 sm:pb-24 bg-gradient-to-b from-surface via-background-app to-background-app border-b border-border-subtle/60">
      {/* Subtle Matrix Background */}
      <GlyphMatrixBackground />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto">
          {/* Top pill badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-6 border border-primary/20 shadow-2xs">
            <Sparkles size={14} className="animate-pulse" aria-hidden="true" />
            <span>Next-Generation Online Converter</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-text-strong tracking-tight leading-[1.1]">
            Any file. <span className="text-primary">Right format.</span>
          </h1>

          {/* Subcopy */}
          <p className="mt-5 text-base sm:text-lg text-text-muted leading-relaxed max-w-2xl mx-auto">
            {description}
          </p>

          {/* Dual CTAs */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <a
              href="#uploader"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-hover shadow-xs transition-colors focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
            >
              <span>Select or Drop Files</span>
              <ArrowDown size={15} aria-hidden="true" />
            </a>
            <a
              href="#search"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-surface border border-border-subtle text-text-strong text-sm font-semibold hover:bg-background-app hover:border-border-subtle/80 shadow-2xs transition-colors focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
            >
              <span>Explore All Tools</span>
              <Search size={15} className="text-text-muted" aria-hidden="true" />
            </a>
          </div>

          {/* Integrated Stats Grid */}
          <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 text-left">
            {STATS.map((stat) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="p-4 sm:p-5 rounded-2xl bg-surface/90 backdrop-blur-xs border border-border-subtle/80 shadow-2xs hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-lg sm:text-xl font-black text-text-strong tracking-tight">
                      {stat.value}
                    </span>
                    <Icon size={16} className="text-primary/80 shrink-0" aria-hidden="true" />
                  </div>
                  <div className="text-xs font-bold text-text-strong">
                    {stat.label}
                  </div>
                  <div className="mt-0.5 text-[11px] text-text-muted leading-tight">
                    {stat.detail}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Universal Uploader Slot */}
        {children && (
          <div id="uploader" className="mt-12 sm:mt-14 scroll-mt-20">
            {children}
          </div>
        )}
      </div>
    </section>
  );
}
