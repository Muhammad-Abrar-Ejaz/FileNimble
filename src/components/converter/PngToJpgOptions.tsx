"use client";

import React from "react";
import { Sliders, Palette, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface PngToJpgOptionsProps {
  quality: number;
  onQualityChange: (quality: number) => void;
  backgroundColor: string;
  onBackgroundColorChange: (color: string) => void;
  disabled?: boolean;
}

export function PngToJpgOptions({
  quality,
  onQualityChange,
  backgroundColor,
  onBackgroundColorChange,
  disabled = false,
}: PngToJpgOptionsProps) {
  const qualityPercent = Math.round(quality * 100);

  const bgPresets = [
    { label: "White", value: "#FFFFFF", border: true },
    { label: "Black", value: "#000000", border: false },
    { label: "Off-White", value: "#F8FAFC", border: true },
  ];

  const isCustomColor = !bgPresets.some(
    (p) => p.value.toLowerCase() === backgroundColor.toLowerCase()
  );

  return (
    <div className="space-y-6">
      {/* 1. Quality Control */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label
            htmlFor="jpg-quality-slider"
            className="text-xs sm:text-sm font-semibold text-text-strong flex items-center gap-1.5"
          >
            <Sliders size={15} className="text-primary" aria-hidden="true" />
            <span>Image Quality</span>
          </label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">
              {qualityPercent >= 90
                ? "Maximum detail"
                : qualityPercent >= 75
                ? "High quality (recommended)"
                : "Smaller file size"}
            </span>
            <span className="text-xs sm:text-sm font-bold font-mono px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
              {qualityPercent}%
            </span>
          </div>
        </div>

        <input
          id="jpg-quality-slider"
          type="range"
          min="10"
          max="100"
          step="5"
          value={qualityPercent}
          disabled={disabled}
          onChange={(e) => onQualityChange(Number(e.target.value) / 100)}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label={`JPG quality: ${qualityPercent}%`}
        />

        <div className="flex justify-between text-[11px] text-text-muted">
          <span>10% (Smallest file)</span>
          <button
            type="button"
            onClick={() => onQualityChange(0.85)}
            className="text-primary hover:underline font-medium cursor-pointer"
          >
            Reset to 85% (Default)
          </button>
          <span>100% (Highest quality)</span>
        </div>
      </div>

      {/* 2. Transparency / Background Color */}
      <div className="space-y-2 pt-2 border-t border-border-subtle">
        <div className="flex items-center justify-between">
          <label className="text-xs sm:text-sm font-semibold text-text-strong flex items-center gap-1.5">
            <Palette size={15} className="text-primary" aria-hidden="true" />
            <span>Transparency Background</span>
          </label>
          <span className="text-xs text-text-muted">
            JPG has no transparency
          </span>
        </div>
        <p className="text-xs text-text-muted leading-relaxed">
          Transparent PNG areas will be flattened against this background color.
        </p>

        <div className="flex items-center gap-2.5 flex-wrap pt-1">
          {bgPresets.map((preset) => {
            const isSelected =
              backgroundColor.toLowerCase() === preset.value.toLowerCase();
            return (
              <button
                key={preset.value}
                type="button"
                disabled={disabled}
                onClick={() => onBackgroundColorChange(preset.value)}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border",
                  isSelected
                    ? "bg-primary text-white border-primary shadow-xs"
                    : "bg-surface text-text-strong border-border-subtle hover:bg-gray-50"
                )}
                aria-pressed={isSelected}
              >
                <span
                  className={cn(
                    "w-3.5 h-3.5 rounded-full shrink-0",
                    preset.border && "border border-gray-300"
                  )}
                  style={{ backgroundColor: preset.value }}
                />
                <span>{preset.label}</span>
                {isSelected && <Check size={12} className="ml-0.5" />}
              </button>
            );
          })}

          {/* Custom Color Selector */}
          <div
            className={cn(
              "flex items-center gap-2 px-3 py-1 rounded-xl text-xs font-semibold border transition-all",
              isCustomColor
                ? "border-primary bg-primary/5 text-primary shadow-xs"
                : "border-border-subtle bg-surface text-text-muted hover:bg-gray-50"
            )}
          >
            <input
              type="color"
              value={backgroundColor}
              disabled={disabled}
              onChange={(e) => onBackgroundColorChange(e.target.value)}
              className="w-5 h-5 rounded-md border-0 p-0 cursor-pointer bg-transparent"
              aria-label="Pick custom background color"
            />
            <span className="font-mono uppercase text-[11px]">
              {backgroundColor}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
