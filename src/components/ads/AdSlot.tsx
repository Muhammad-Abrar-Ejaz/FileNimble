"use client";

import React, { useEffect, useRef } from "react";
import { getAdConfig, isAdSenseActive, isToolMonetizable, AdFormat } from "@/config/ads";
import { ToolRecord } from "@/types/tool";
import { cn } from "@/lib/utils";

export interface AdSlotProps {
  /** Unique placement identifier (e.g. "tool-after-converter", "home-after-hero") */
  placement: string;
  /** Format of the ad unit: horizontal (leaderboard/banner), rectangle, or fluid */
  format?: AdFormat;
  /** Explicit AdSense slot ID override (if configured in AdSense console) */
  slotId?: string;
  /** Associated ToolRecord if rendered on a tool page, used to enforce monetization eligibility */
  tool?: ToolRecord | null;
  /** Additional CSS class names */
  className?: string;
}

/**
 * Shared, accessible, layout-stable AdSlot component.
 *
 * Safety & Quality Principles (FN-160 to FN-165):
 * 1. Disabled by default: renders null when not enabled or missing configuration.
 * 2. CLS Prevention: reserves container height when active or in test mode.
 * 3. Separation from Actions: distinct visual boundary, substantial margins, no button styling.
 * 4. Transparent, Neutral Labelling: strictly labelled "Advertisement" without deceptive text.
 * 5. Policy QA: suppresses ads on non-monetizable/planned tools.
 */
export function AdSlot({
  placement,
  format = "horizontal",
  slotId,
  tool,
  className,
}: AdSlotProps) {
  const config = getAdConfig();

  // Policy QA: If this slot belongs to a tool page, verify tool is live and indexable.
  if (tool !== undefined && !isToolMonetizable(tool)) {
    return null;
  }

  // If ads are not enabled globally and not in test mode, render nothing (no CLS, no empty box).
  if (!config.enabled && !config.testMode) {
    return null;
  }

  // Resolve slot ID: prop override > config slot map > undefined (auto-slot)
  const effectiveSlotId =
    slotId ||
    (placement === "tool-after-converter"
      ? config.slots.toolAfterConverter
      : placement === "tool-in-content"
      ? config.slots.toolInContent
      : placement === "home-after-hero"
      ? config.slots.homeAfterHero
      : placement === "home-between-sections"
      ? config.slots.homeBetweenSections
      : placement === "directory-bottom"
      ? config.slots.directoryBottom
      : placement === "formats-bottom"
      ? config.slots.formatsBottom
      : undefined);

  // Height reservation to eliminate Cumulative Layout Shift (CLS)
  const minHeightClass =
    format === "rectangle"
      ? "min-h-[250px] sm:min-h-[280px] max-w-[336px]"
      : "min-h-[90px] sm:min-h-[100px] max-w-4xl";

  // Test mode rendering: shows an accessible preview box without requesting third-party scripts
  if (config.testMode) {
    return (
      <aside
        aria-label="Advertisement Preview"
        role="region"
        data-testid={`ad-slot-${placement}`}
        className={cn(
          "w-full my-8 sm:my-10 mx-auto px-4 py-3 rounded-2xl border border-dashed border-border-subtle bg-surface/60 text-center select-none",
          minHeightClass,
          className
        )}
      >
        <div className="flex flex-col items-center justify-center h-full py-4 text-text-muted">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted/80">
            Advertisement (Preview / Test Mode)
          </span>
          <p className="mt-1 text-xs text-text-muted/60">
            Placement: <code className="font-mono text-[11px]">{placement}</code> | Format: {format}
            {effectiveSlotId ? ` | Slot: ${effectiveSlotId}` : " | Auto-Responsive"}
          </p>
        </div>
      </aside>
    );
  }

  // Active production AdSense rendering
  const isLive = isAdSenseActive(config);
  if (!isLive) {
    return null;
  }

  return (
    <LiveAdUnit
      clientId={config.clientId!}
      slotId={effectiveSlotId}
      format={format}
      placement={placement}
      minHeightClass={minHeightClass}
      className={className}
    />
  );
}

interface LiveAdUnitProps {
  clientId: string;
  slotId?: string;
  format: AdFormat;
  placement: string;
  minHeightClass: string;
  className?: string;
}

function LiveAdUnit({
  clientId,
  slotId,
  format,
  placement,
  minHeightClass,
  className,
}: LiveAdUnitProps) {
  const adPushedRef = useRef(false);

  useEffect(() => {
    if (adPushedRef.current) return;
    adPushedRef.current = true;

    try {
      if (typeof window !== "undefined") {
        const win = window as unknown as { adsbygoogle?: unknown[] };
        win.adsbygoogle = win.adsbygoogle || [];
        win.adsbygoogle.push({});
      }
    } catch {
      // Safely ignore duplicate push errors from fast client-side navigation
    }
  }, []);

  return (
    <aside
      aria-label="Advertisement"
      role="region"
      data-testid={`ad-slot-${placement}`}
      className={cn(
        "w-full my-8 sm:my-10 mx-auto px-2 py-3 rounded-2xl border border-border-subtle/70 bg-surface/40 overflow-hidden",
        minHeightClass,
        className
      )}
    >
      {/* Neutral, non-deceptive label strictly required by AdSense policy */}
      <div
        className="text-center text-[10px] sm:text-[11px] font-medium tracking-wider uppercase text-text-muted mb-2 select-none"
        aria-hidden="true"
      >
        Advertisement
      </div>

      <div className="w-full flex items-center justify-center overflow-hidden">
        <ins
          className="adsbygoogle"
          style={{ display: "block", width: "100%", textAlign: "center" }}
          data-ad-client={clientId}
          data-ad-slot={slotId}
          data-ad-format={format === "rectangle" ? "rectangle" : "auto"}
          data-full-width-responsive="true"
        />
      </div>
    </aside>
  );
}
