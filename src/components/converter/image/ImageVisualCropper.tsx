'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ImageCropOptions, clampCropBounds } from '@/lib/converters/image';
import { validateImageDimensions } from '@/lib/converters/image/transforms';
import { Crop, RotateCcw } from 'lucide-react';

interface ImageVisualCropperProps {
  file: File;
  crop: ImageCropOptions;
  onChange: (crop: ImageCropOptions) => void;
}

type AspectRatioPreset = 'free' | '1:1' | '4:3' | '16:9';

export function ImageVisualCropper({ file, crop, onChange }: ImageVisualCropperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [naturalWidth, setNaturalWidth] = useState<number>(0);
  const [naturalHeight, setNaturalHeight] = useState<number>(0);
  const [preset, setPreset] = useState<AspectRatioPreset>('free');
  const drag = useRef<{ x: number; y: number; crop: ImageCropOptions; resize: boolean } | null>(null);
  const [error, setError] = useState('');

  // Load image preview URL
  useEffect(() => {
    const url = URL.createObjectURL(file);

    const img = new Image();
    img.onload = () => {
      try {
        validateImageDimensions(img.naturalWidth, img.naturalHeight);
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Image dimensions exceed the supported limits.');
        img.src = '';
        URL.revokeObjectURL(url);
        return;
      }
      setImageUrl(url);
      setNaturalWidth(img.naturalWidth);
      setNaturalHeight(img.naturalHeight);
      // Initialize crop to full image if empty
        onChange({
          x: 0,
          y: 0,
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
    };
    img.onerror = () => setError('Could not decode the crop preview. Remove this file and choose a valid image.');
    img.src = url;

    return () => {
      img.onload = null;
      img.onerror = null;
      img.src = '';
      URL.revokeObjectURL(url);
    };
  }, [file, onChange]);

  const startDrag = (e: React.PointerEvent, resize = false) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, crop: { ...crop }, resize };
  };
  const moveDrag = (e: React.PointerEvent) => {
    if (!drag.current || !containerRef.current) return;
    const bounds = containerRef.current.getBoundingClientRect();
    const { x, y, crop: initial, resize } = drag.current;
    const dx = (e.clientX - x) * naturalWidth / bounds.width;
    const dy = (e.clientY - y) * naturalHeight / bounds.height;
    if (!resize) {
      onChange({ ...initial, x: Math.round(Math.max(0, Math.min(naturalWidth - initial.width, initial.x + dx))), y: Math.round(Math.max(0, Math.min(naturalHeight - initial.height, initial.y + dy))) });
    } else {
      let width = Math.max(1, Math.min(naturalWidth - initial.x, initial.width + dx));
      let height = Math.max(1, Math.min(naturalHeight - initial.y, initial.height + dy));
      const ratio = preset === '1:1' ? 1 : preset === '4:3' ? 4 / 3 : preset === '16:9' ? 16 / 9 : 0;
      if (ratio) { width = Math.min(width, (naturalHeight - initial.y) * ratio); height = width / ratio; }
      onChange(clampCropBounds(naturalWidth, naturalHeight, { ...initial, width, height }));
    }
  };

  const applyPreset = useCallback(
    (newPreset: AspectRatioPreset) => {
      setPreset(newPreset);
      if (!naturalWidth || !naturalHeight) return;

      if (newPreset === 'free') return;

      let targetRatio = 1;
      if (newPreset === '1:1') targetRatio = 1;
      if (newPreset === '4:3') targetRatio = 4 / 3;
      if (newPreset === '16:9') targetRatio = 16 / 9;

      let w = naturalWidth;
      let h = Math.round(w / targetRatio);

      if (h > naturalHeight) {
        h = naturalHeight;
        w = Math.round(h * targetRatio);
      }

      const x = Math.max(0, Math.round((naturalWidth - w) / 2));
      const y = Math.max(0, Math.round((naturalHeight - h) / 2));

      onChange({ x, y, width: w, height: h });
    },
    [naturalWidth, naturalHeight, onChange]
  );

  const resetCrop = useCallback(() => {
    setPreset('free');
    if (naturalWidth && naturalHeight) {
      onChange({ x: 0, y: 0, width: naturalWidth, height: naturalHeight });
    }
  }, [naturalWidth, naturalHeight, onChange]);

  // Compute percentage styles for the crop overlay box
  const cropBoxStyle: React.CSSProperties =
    naturalWidth && naturalHeight
      ? {
          left: `${(crop.x / naturalWidth) * 100}%`,
          top: `${(crop.y / naturalHeight) * 100}%`,
          width: `${(crop.width / naturalWidth) * 100}%`,
          height: `${(crop.height / naturalHeight) * 100}%`,
        }
      : { left: '0%', top: '0%', width: '100%', height: '100%' };

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Crop className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Interactive Visual Cropper
          </h3>
        </div>

        {/* Aspect Ratio Presets */}
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Aspect Ratio Presets">
          {(['free', '1:1', '4:3', '16:9'] as AspectRatioPreset[]).map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={preset === p}
              onClick={() => applyPreset(p)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                preset === p
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {p === 'free' ? 'Freeform' : p}
            </button>
          ))}
          <button
            type="button"
            onClick={resetCrop}
            className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
            title="Reset crop to full image"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
        </div>
      </div>

      {/* Visual Canvas Container with Dark Mask and Highlighted Selection Box */}
      <div
        className="relative mx-auto max-h-[420px] w-full max-w-2xl select-none overflow-hidden rounded-lg bg-slate-950 flex items-center justify-center p-2"
      >
        {imageUrl ? (
          <div ref={containerRef} className="relative inline-block max-h-[380px] max-w-full overflow-hidden">
            {/* Background image */}
            {/* Local blob preview must bypass server image optimization. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="Crop preview"
              className="max-h-[380px] w-auto object-contain block opacity-70"
            />

            {/* Visual Crop Box */}
            <div
              style={cropBoxStyle}
              role="group"
              aria-label="Crop selection"
              tabIndex={0}
              onPointerDown={e => startDrag(e)}
              onPointerMove={moveDrag}
              onPointerUp={() => { drag.current = null; }}
              onPointerCancel={() => { drag.current = null; }}
              onKeyDown={e => {
                const delta = e.shiftKey ? 10 : 1;
                const directions: Record<string, [number, number]> = { ArrowLeft: [-delta, 0], ArrowRight: [delta, 0], ArrowUp: [0, -delta], ArrowDown: [0, delta] };
                const step = directions[e.key];
                if (step) { e.preventDefault(); onChange({ ...crop, x: Math.max(0, Math.min(naturalWidth - crop.width, crop.x + step[0])), y: Math.max(0, Math.min(naturalHeight - crop.height, crop.y + step[1])) }); }
              }}
              className="absolute touch-none border-2 border-indigo-400 bg-indigo-500/10 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] cursor-move"
            >
              {/* Corner indicators */}
              <span className="absolute -top-1.5 -left-1.5 h-3 w-3 rounded-full border border-white bg-indigo-600" />
              <span className="absolute -top-1.5 -right-1.5 h-3 w-3 rounded-full border border-white bg-indigo-600" />
              <span className="absolute -bottom-1.5 -left-1.5 h-3 w-3 rounded-full border border-white bg-indigo-600" />
              <button type="button" aria-label="Resize crop selection" onPointerDown={e => startDrag(e, true)} className="absolute bottom-0 right-0 h-6 w-6 touch-none cursor-se-resize border border-white bg-indigo-600" />

              {/* Center crosshair / grid */}
              <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-40">
                <div className="border-r border-b border-indigo-200 border-dashed" />
                <div className="border-r border-b border-indigo-200 border-dashed" />
                <div className="border-b border-indigo-200 border-dashed" />
                <div className="border-r border-b border-indigo-200 border-dashed" />
                <div className="border-r border-b border-indigo-200 border-dashed" />
                <div className="border-b border-indigo-200 border-dashed" />
                <div className="border-r border-indigo-200 border-dashed" />
                <div className="border-r border-indigo-200 border-dashed" />
                <div />
              </div>
            </div>
          </div>
        ) : (
          <div className="py-20 text-sm text-slate-400">Loading preview...</div>
        )}
      </div>
      {error && <p role="alert">{error}</p>}
      <p className="text-xs">Drag the selection to move it; drag its bottom-right handle to resize. Arrow keys move the focused selection (Shift for 10 pixels). Numeric fields support precise freeform edits.</p>

      {/* Supplementary Numeric Fields */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 pt-2">
        <div>
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
            X Offset (px)
          </label>
          <input
            type="number"
            min={0}
            max={naturalWidth - 1 || 0}
            aria-label="X Offset (px)"
            value={crop.x}
            onChange={(e) => { setPreset('free'); onChange(clampCropBounds(naturalWidth, naturalHeight, { ...crop, x: Math.max(0, parseInt(e.target.value) || 0) })); }}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
            Y Offset (px)
          </label>
          <input
            type="number"
            min={0}
            max={naturalHeight - 1 || 0}
            aria-label="Y Offset (px)"
            value={crop.y}
            onChange={(e) => { setPreset('free'); onChange(clampCropBounds(naturalWidth, naturalHeight, { ...crop, y: Math.max(0, parseInt(e.target.value) || 0) })); }}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
            Crop Width (px)
          </label>
          <input
            type="number"
            min={1}
            max={naturalWidth - crop.x || 1}
            aria-label="Crop Width (px)"
            value={crop.width}
            onChange={(e) => {
              setPreset('free');
              onChange({
                ...crop,
                width: Math.max(1, Math.min(naturalWidth - crop.x, parseInt(e.target.value) || 1)),
              });
            }}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
            Crop Height (px)
          </label>
          <input
            type="number"
            min={1}
            max={naturalHeight - crop.y || 1}
            aria-label="Crop Height (px)"
            value={crop.height}
            onChange={(e) => {
              setPreset('free');
              onChange({
                ...crop,
                height: Math.max(1, Math.min(naturalHeight - crop.y, parseInt(e.target.value) || 1)),
              });
            }}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Original Dimensions: {naturalWidth} × {naturalHeight} px &bull; Output Size:{' '}
        <span className="font-semibold text-indigo-600 dark:text-indigo-400">
          {crop.width} × {crop.height} px
        </span>
      </p>
    </div>
  );
}
