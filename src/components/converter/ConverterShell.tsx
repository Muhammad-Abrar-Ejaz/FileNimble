"use client";

import React, { ReactNode } from "react";
import { ToolRecord } from "@/types/tool";
import { UniversalUploader, UniversalUploaderProps } from "../uploader/UniversalUploader";
import { ValidatedFile } from "../uploader/FileRow";
import { useConverterState, ConvertedResultFile } from "./useConverterState";
import { ConverterStateView } from "./ConverterStateView";
import { PrivacyBadge } from "../tools/PrivacyBadge";
import { getCategoryIcon } from "../tools/ToolCard";
import { CATEGORIES } from "@/config/categories";
import { cn } from "@/lib/utils";

export interface ConverterShellProps {
  tool?: ToolRecord;
  title?: string;
  description?: string;
  category?: ToolRecord["category"];
  processingMode?: ToolRecord["processingMode"];
  uploaderProps?: Partial<UniversalUploaderProps>;
  optionsPanel?: ReactNode;
  actionLabel?: string;
  onConvert?: (files: ValidatedFile[], setComplete: (r: ConvertedResultFile[]) => void) => Promise<void> | void;
  className?: string;
}

export function ConverterShell({
  tool,
  title,
  description,
  category,
  processingMode,
  uploaderProps,
  optionsPanel,
  actionLabel = "Convert Files",
  onConvert,
  className,
}: ConverterShellProps) {
  const effectiveTitle = title || tool?.title || tool?.slug || "File Converter";
  const effectiveDesc = description || tool?.description || "Select files to begin conversion.";
  const effectiveCategory = category || tool?.category || "pdf";
  const effectiveMode = processingMode || tool?.processingMode || "client";
  const categoryMeta = CATEGORIES[effectiveCategory];

  const {
    state,
    setFiles,
    startProcessing,
    setComplete,
    setFailed,
    cancel,
    reset,
  } = useConverterState();

  const handleConvertTrigger = async () => {
    if (onConvert) {
      startProcessing("Converting your files...");
      try {
        await onConvert(state.files, (results) => setComplete(results));
      } catch (err) {
        setFailed("CORRUPT_FILE", (err as Error).message || "Conversion failed.");
      }
    }
  };

  return (
    <div className={cn("w-full max-w-4xl mx-auto space-y-6", className)}>
      {/* Tool Header Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-surface border border-border-subtle shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-4">
            <div
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: categoryMeta?.bgLight || "#F3F4F6" }}
            >
              {getCategoryIcon(effectiveCategory, 26)}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-semibold border", categoryMeta?.badgeClass)}>
                  {categoryMeta?.name || effectiveCategory}
                </span>
                <PrivacyBadge mode={effectiveMode} />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-text-strong tracking-tight">
                {effectiveTitle}
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-text-muted">
                {effectiveDesc}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Converter Workflow Area */}
      {state.status === "idle" || state.status === "ready" ? (
        <div className="space-y-6">
          <UniversalUploader
            allowedExtensions={tool?.limits?.allowedExtensions || tool?.inputFormats}
            allowedMimeTypes={tool?.limits?.allowedMimeTypes}
            maxFileBytes={tool?.limits?.maxFileBytes}
            maxBatchCount={tool?.limits?.maxBatchCount}
            onFilesChange={setFiles}
            {...uploaderProps}
          />

          {optionsPanel && state.status === "ready" && (
            <div className="p-6 rounded-2xl bg-surface border border-border-subtle shadow-xs">
              <h3 className="text-sm font-bold text-text-strong mb-3">Conversion Options</h3>
              {optionsPanel}
            </div>
          )}

          {state.status === "ready" && (
            <ConverterStateView
              state={state}
              onConvert={handleConvertTrigger}
              onReset={reset}
              actionLabel={actionLabel}
            />
          )}
        </div>
      ) : (
        <ConverterStateView
          state={state}
          onConvert={handleConvertTrigger}
          onCancel={cancel}
          onReset={reset}
          actionLabel={actionLabel}
        />
      )}
    </div>
  );
}
