'use client';

import React, { useState } from 'react';
import { Sliders, Palette, Maximize2, FileText, Info } from 'lucide-react';
import { ImageResizeOptions, ImageToPdfOptions } from '@/lib/converters/image';

export interface ImageOptionsBarProps {
  // Mode toggles
  showQuality?: boolean;
  quality?: number; // 0.1 to 1.0
  onQualityChange?: (q: number) => void;

  showBackground?: boolean;
  backgroundColor?: string;
  onBackgroundChange?: (bg: string) => void;

  showResize?: boolean;
  resize?: ImageResizeOptions;
  onResizeChange?: (opts: ImageResizeOptions) => void;

  showCompressNotice?: boolean;
  compressTarget?: 'original' | 'webp';
  onCompressTargetChange?: (target: 'original' | 'webp') => void;

  showPdfOptions?: boolean;
  pdfOptions?: ImageToPdfOptions;
  onPdfOptionsChange?: (opts: ImageToPdfOptions) => void;

  hasPngInput?: boolean;
}

const PRESET_BACKGROUNDS = [
  { label: 'White', color: '#FFFFFF', border: 'border-slate-300' },
  { label: 'Black', color: '#000000', border: 'border-slate-800' },
];

export function ImageOptionsBar({
  showQuality,
  quality = 0.85,
  onQualityChange,
  showBackground,
  backgroundColor = '#FFFFFF',
  onBackgroundChange,
  showResize,
  resize = { maintainAspectRatio: true },
  onResizeChange,
  showCompressNotice,
  compressTarget = 'original',
  onCompressTargetChange,
  showPdfOptions,
  pdfOptions = { pageSize: 'a4', orientation: 'auto', margin: 20, combine: true },
  onPdfOptionsChange,

}: ImageOptionsBarProps) {
  const [isCustomColor, setIsCustomColor] = useState(
    !['#FFFFFF', '#000000'].includes(backgroundColor.toUpperCase())
  );

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      {/* 1. Quality Slider */}
      {showQuality && onQualityChange && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sliders className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <label htmlFor="quality-slider" className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Image Quality
              </label>
            </div>
            <span className="rounded-md bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
              {Math.round(quality * 100)}%
            </span>
          </div>
          <input
            id="quality-slider"
            type="range"
            min="10"
            max="100"
            step="5"
            value={Math.round(quality * 100)}
            onChange={(e) => onQualityChange(parseInt(e.target.value) / 100)}
            className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-indigo-600 dark:bg-slate-700"
            aria-label="Image Quality Slider"
            aria-valuemin={10}
            aria-valuemax={100}
            aria-valuenow={Math.round(quality * 100)}
          />
          <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Smallest file (10%)</span>
            <span>Recommended (85%)</span>
            <span>Maximum fidelity (100%)</span>
          </div>
        </div>
      )}

      {/* 2. PNG Compression Notice (Honest Technical Warning) */}
      {showCompressNotice && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">PNG is a Lossless Format</p>
              <p className="text-slate-600 dark:text-slate-400">
                Standard browser encoders compress PNG losslessly without quality degradation. To achieve
                different file sizes, you can optionally convert to lossy WebP. Savings depend on the image; output can be larger. PNG ignores the quality setting:
              </p>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => onCompressTargetChange?.('original')}
                  className={`rounded px-2.5 py-1 font-medium transition-colors ${
                    compressTarget === 'original'
                      ? 'bg-amber-600 text-white'
                      : 'bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-900/60 dark:text-amber-200'
                  }`}
                >
                  Keep Original Format
                </button>
                <button
                  type="button"
                  onClick={() => onCompressTargetChange?.('webp')}
                  className={`rounded px-2.5 py-1 font-medium transition-colors ${
                    compressTarget === 'webp'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-indigo-100 text-indigo-900 hover:bg-indigo-200 dark:bg-indigo-900/60 dark:text-indigo-200'
                  }`}
                >
                  Convert to Lossy WebP
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Transparency Background Color Picker (For JPG output) */}
      {showBackground && onBackgroundChange && (
        <div className="space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Transparency Background
            </label>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            JPG does not support transparency. Transparent pixels are flattened onto this background color:
          </p>

          <div className="flex flex-wrap items-center gap-3" role="radiogroup" aria-label="Background Color">
            {PRESET_BACKGROUNDS.map((preset) => {
              const isSelected = !isCustomColor && backgroundColor.toUpperCase() === preset.color;
              return (
                <button
                  key={preset.color}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onKeyDown={e => {
                    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
                      e.preventDefault();
                      const radios = [...e.currentTarget.parentElement!.querySelectorAll<HTMLButtonElement>('button[role=radio]')];
                      const next = radios[(radios.indexOf(e.currentTarget) + 1) % radios.length];
                      next.focus(); next.click();
                    }
                  }}
                  onClick={() => {
                    setIsCustomColor(false);
                    onBackgroundChange(preset.color);
                  }}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                    isSelected
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-900 ring-2 ring-indigo-600/20 dark:bg-indigo-950/40 dark:text-indigo-200'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 rounded-full border ${preset.border}`}
                    style={{ backgroundColor: preset.color }}
                  />
                  {preset.label}
                </button>
              );
            })}

            {/* Custom Hex Color Picker */}
            <div className="flex items-center gap-2">
              <label
                htmlFor="custom-color-picker"
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                  isCustomColor
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-900 ring-2 ring-indigo-600/20 dark:bg-indigo-950/40 dark:text-indigo-200'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                <input
                  id="custom-color-picker"
                  type="color"
                  value={backgroundColor}
                  onChange={(e) => {
                    setIsCustomColor(true);
                    onBackgroundChange(e.target.value.toUpperCase());
                  }}
                  className="h-4 w-4 cursor-pointer appearance-none rounded border-0 bg-transparent p-0"
                />
                Custom Color
              </label>

              {isCustomColor && (
                <input
                  type="text"
                  value={backgroundColor}
                  aria-label="Custom background hex"
                  maxLength={7}
                  onChange={(e) => {
                    let val = e.target.value;
                    if (!val.startsWith('#')) val = `#${val}`;
                    if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                      onBackgroundChange(val.toUpperCase());
                    }
                  }}
                  className="w-20 rounded-md border border-slate-300 bg-white px-2 py-1 text-center font-mono text-xs text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  placeholder="#FFFFFF"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. Resize Dimension Controls */}
      {showResize && onResizeChange && (
        <div className="space-y-3 border-t border-slate-100 pt-3 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Maximize2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Target Dimensions
              </label>
            </div>

            <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={resize.maintainAspectRatio ?? true}
                onChange={(e) => onResizeChange({ ...resize, maintainAspectRatio: e.target.checked })}
                className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              Lock Aspect Ratio
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={resize.allowUpscale ?? false} onChange={e => onResizeChange({ ...resize, allowUpscale: e.target.checked })} />Allow upscaling</label>
          <p className="text-xs">Blank dimensions keep the original size. With aspect ratio locked, width and height form a bounding box. Larger presets never enlarge images unless upscaling is enabled.</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Width (px)
              </label>
              <input
                type="number"
                min="1"
                placeholder="Auto"
                aria-label="Width (px)"
                value={resize.width || ''}
                onChange={(e) =>
                  onResizeChange({ ...resize, width: e.target.value ? parseInt(e.target.value) : undefined })
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Height (px)
              </label>
              <input
                type="number"
                min="1"
                placeholder="Auto"
                aria-label="Height (px)"
                value={resize.height || ''}
                onChange={(e) =>
                  onResizeChange({ ...resize, height: e.target.value ? parseInt(e.target.value) : undefined })
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            <div className="col-span-2 flex items-end gap-1.5">
              <button
                type="button"
                onClick={() => onResizeChange({ ...resize, width: 1920, height: 1080 })}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                1920×1080 (HD)
              </button>
              <button
                type="button"
                onClick={() => onResizeChange({ ...resize, width: 1080, height: 1080 })}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                1:1 Square
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. PDF Options */}
      {showPdfOptions && onPdfOptionsChange && (
        <div className="space-y-3 border-t border-slate-100 pt-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              PDF Document Settings
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Page Format
              </label>
              <select
                aria-label="Page Format"
                value={pdfOptions.pageSize || 'a4'}
                onChange={(e) =>
                  onPdfOptionsChange({
                    ...pdfOptions,
                    pageSize: e.target.value as 'fit' | 'a4' | 'letter',
                  })
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="a4">A4 (Standard Document)</option>
                <option value="letter">Letter (US)</option>
                <option value="fit">Fit to Image Size</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Orientation
              </label>
              <select
                aria-label="Orientation"
                value={pdfOptions.orientation || 'auto'}
                onChange={(e) =>
                  onPdfOptionsChange({
                    ...pdfOptions,
                    orientation: e.target.value as 'auto' | 'portrait' | 'landscape',
                  })
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="auto">Auto (Match Image)</option>
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Page Margins
              </label>
              <select
                aria-label="Page Margins"
                value={pdfOptions.margin ?? 20}
                onChange={(e) =>
                  onPdfOptionsChange({
                    ...pdfOptions,
                    margin: parseInt(e.target.value),
                  })
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value={0}>No Margins (0pt)</option>
                <option value={20}>Standard (20pt)</option>
                <option value={40}>Wide (40pt)</option>
              </select>
            </div>
          </div>

          <div className="pt-1">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={pdfOptions.combine ?? true}
                onChange={(e) =>
                  onPdfOptionsChange({
                    ...pdfOptions,
                    combine: e.target.checked,
                  })
                }
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              Merge all uploaded images into a single multi-page PDF document
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
