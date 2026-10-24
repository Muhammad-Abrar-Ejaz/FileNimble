"use client";

import React, { useState } from "react";
import { CategoryMeta } from "@/config/categories";
import { ToolRecord } from "@/types/tool";
import { getCategoryIcon } from "./ToolCard";
import { ArrowRight, RotateCw, FileCode, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CategoryFlipCardProps {
  category: CategoryMeta;
  tools: ToolRecord[];
  onSelectCategory?: (category: CategoryMeta["id"]) => void;
}

const CATEGORY_FORMATS: Record<string, string[]> = {
  pdf: [".pdf", ".pdfa", "Merge", "Split", "Compress"],
  to_pdf: [".docx", ".pptx", ".jpg", ".png", ".txt"],
  from_pdf: [".docx", ".xlsx", ".jpg", ".png", ".txt"],
  image: [".png", ".jpg", ".webp", ".svg", ".gif"],
  document_data: [".docx", ".xlsx", ".csv", ".json", ".xml", ".md"],
  ebook: [".epub", ".mobi", ".pdf", ".txt"],
  audio: [".mp3", ".wav", ".m4a", ".ogg", ".flac"],
  video: [".mp4", ".webm", ".gif"],
  archive: [".tar", ".zip", ".gz", ".7z"],
  ocr: [".pdf", ".png", ".jpg", ".tiff"],
  ai: [".pdf", ".docx", ".txt", "Summarize"],
};

export function CategoryFlipCard({
  category,
  tools,
  onSelectCategory,
}: CategoryFlipCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);

  const categoryTools = tools.filter((t) => t.category === category.id);
  const count = categoryTools.length;
  const liveTools = categoryTools.filter((t) => t.status === "live").slice(0, 2);
  const formats = CATEGORY_FORMATS[category.id] || [".pdf", ".zip", ".png"];

  const handleFlipToggle = (e: React.MouseEvent | React.KeyboardEvent) => {
    // Only toggle if not clicking on an interactive anchor or button inside
    const target = e.target as HTMLElement;
    if (target.closest("a") || target.closest("button.action-btn")) return;
    setIsFlipped(!isFlipped);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      const target = e.target as HTMLElement;
      if (target.tagName !== "A" && target.tagName !== "BUTTON") {
        e.preventDefault();
        setIsFlipped(!isFlipped);
      }
    }
  };

  return (
    <div
      className="perspective-1000 h-[260px] w-full"
      tabIndex={0}
      role="region"
      aria-label={
        isFlipped
          ? `${category.name} category card formats and tools. Press Enter to flip back.`
          : `${category.name} category card. Press Enter to flip for supported formats.`
      }
      onKeyDown={handleKeyDown}
    >
      <div
        className={cn(
          "relative w-full h-full duration-500 transform-style-preserve-3d transition-transform rounded-2xl shadow-xs",
          isFlipped && "rotate-y-180"
        )}
      >
        {/* FRONT SIDE */}
        <div
          inert={isFlipped ? true : undefined}
          aria-hidden={isFlipped}
          className={cn(
            "absolute inset-0 w-full h-full backface-hidden rounded-2xl bg-surface border border-border-subtle p-5 flex flex-col justify-between select-none",
            "hover:border-primary/40 hover:shadow-md transition-all duration-200 cursor-pointer",
            isFlipped && "pointer-events-none"
          )}
          onClick={handleFlipToggle}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: category.bgLight }}
              >
                {getCategoryIcon(category.id, 24)}
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "text-xs font-semibold px-2.5 py-1 rounded-full border",
                    category.badgeClass
                  )}
                >
                  {count} {count === 1 ? "tool" : "tools"}
                </span>
                <button
                  type="button"
                  tabIndex={isFlipped ? -1 : 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsFlipped(true);
                  }}
                  className="action-btn min-h-[32px] min-w-[32px] p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-background-app transition-colors inline-flex items-center justify-center focus-visible:outline-2 focus-visible:outline-primary"
                  aria-label={`View supported formats for ${category.name}`}
                  title="Flip card for supported formats"
                >
                  <RotateCw size={13} aria-hidden="true" />
                </button>
              </div>
            </div>

            <h3 className="text-base font-bold text-text-strong group-hover:text-primary transition-colors">
              {category.name}
            </h3>
            <p className="mt-1.5 text-xs text-text-muted leading-relaxed line-clamp-2">
              {category.description}
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-border-subtle/80 flex items-center justify-between text-xs font-medium text-primary">
            <span>Explore category</span>
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-text-muted mr-1 hidden sm:inline">
                Tap to flip
              </span>
              <ArrowRight size={14} aria-hidden="true" />
            </div>
          </div>
        </div>

        {/* BACK SIDE */}
        <div
          inert={!isFlipped ? true : undefined}
          aria-hidden={!isFlipped}
          className={cn(
            "absolute inset-0 w-full h-full backface-hidden rotate-y-180 rounded-2xl bg-surface border border-primary/30 p-5 flex flex-col justify-between shadow-sm select-none",
            "bg-gradient-to-br from-surface via-background-app to-surface",
            !isFlipped && "pointer-events-none"
          )}
        >
          <div>
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-border-subtle/80">
              <div className="flex items-center gap-2">
                <FileCode size={16} className="text-primary" aria-hidden="true" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-text-strong">
                  Formats & Highlights
                </h4>
              </div>
              <button
                type="button"
                tabIndex={isFlipped ? 0 : -1}
                onClick={() => setIsFlipped(false)}
                className="action-btn text-[11px] font-semibold text-text-muted hover:text-primary inline-flex items-center gap-1.5 min-h-[32px] px-2 py-1 rounded-md hover:bg-background-app transition-colors focus-visible:outline-2 focus-visible:outline-primary"
                aria-label="Flip back to front"
              >
                <RotateCw size={12} aria-hidden="true" />
                <span>Back</span>
              </button>
            </div>

            {/* Formats row */}
            <div className="mt-2">
              <div className="text-[11px] font-semibold text-text-muted mb-1.5">
                Key Formats Supported
              </div>
              <div className="flex flex-wrap gap-1">
                {formats.map((fmt) => (
                  <span
                    key={fmt}
                    className="px-2 py-0.5 rounded-md bg-surface border border-border-subtle text-[11px] font-medium text-text-strong"
                  >
                    {fmt}
                  </span>
                ))}
              </div>
            </div>

            {/* Live tools links if available */}
            {liveTools.length > 0 && (
              <div className="mt-3">
                <div className="text-[11px] font-semibold text-text-muted mb-1.5 flex items-center gap-1">
                  <CheckCircle2 size={12} className="text-emerald-600" aria-hidden="true" />
                  <span>Popular Live Tools</span>
                </div>
                <div className="flex flex-col gap-1">
                  {liveTools.map((t) => (
                    <a
                      key={t.id}
                      href={`/${t.slug}`}
                      tabIndex={isFlipped ? 0 : -1}
                      className="flex items-center min-h-[28px] px-2 py-1 rounded-md text-xs font-medium text-primary hover:bg-primary/5 hover:underline truncate transition-colors focus-visible:outline-2 focus-visible:outline-primary"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="truncate">→ {t.title}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-border-subtle/80">
            {onSelectCategory ? (
              <button
                type="button"
                tabIndex={isFlipped ? 0 : -1}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectCategory(category.id);
                }}
                className="action-btn w-full py-2 px-3 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-hover transition-colors flex items-center justify-center gap-1.5 focus-visible:outline-2 focus-visible:outline-primary"
              >
                <span>View all {count} tools</span>
                <ArrowRight size={13} aria-hidden="true" />
              </button>
            ) : (
              <a
                href={`/#${category.id}`}
                tabIndex={isFlipped ? 0 : -1}
                onClick={(e) => e.stopPropagation()}
                className="w-full py-2 px-3 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-hover transition-colors flex items-center justify-center gap-1.5 text-center focus-visible:outline-2 focus-visible:outline-primary"
              >
                <span>View all {count} tools</span>
                <ArrowRight size={13} aria-hidden="true" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
