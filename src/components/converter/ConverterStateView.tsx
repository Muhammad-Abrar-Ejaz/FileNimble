import React from "react";
import { ConverterState } from "./useConverterState";
import { formatBytes } from "@/lib/utils";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Download,
  RotateCcw,
  Ban,
  Clock,
  FileCheck,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ConverterStateViewProps {
  state: ConverterState;
  onConvert?: () => void;
  onCancel?: () => void;
  onReset?: () => void;
  onDownloadSingle?: (file: ConverterState["resultFiles"][0]) => void;
  onDownloadAll?: () => void;
  actionLabel?: string;
  className?: string;
  isProcessing?: boolean;
}

export function ConverterStateView({
  state,
  onConvert,
  onCancel,
  onReset,
  onDownloadSingle,
  onDownloadAll,
  actionLabel = "Convert Now",
  className,
}: ConverterStateViewProps) {
  const { status, files, resultFiles, errorCode, errorMessage, processingMessage } = state;
  const validFiles = files.filter((f) => f.status === "valid");

  switch (status) {
    case "validating":
      return (
        <div
          role="status"
          className={cn(
            "p-8 text-center rounded-2xl bg-surface border border-border-subtle shadow-xs",
            className
          )}
        >
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
            <Loader2 size={24} className="animate-spin" aria-hidden="true" />
          </div>
          <h4 className="text-base font-semibold text-text-strong">Validating files...</h4>
          <p className="mt-1 text-xs text-text-muted">
            Checking magic bytes, MIME plausibility, and security constraints.
          </p>
        </div>
      );

    case "ready":
      return (
        <div
          className={cn(
            "p-6 rounded-2xl bg-surface border border-border-subtle shadow-xs space-y-4",
            className
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCheck size={18} className="text-emerald-600" aria-hidden="true" />
              <span className="text-sm font-semibold text-text-strong">
                {validFiles.length} {validFiles.length === 1 ? "file" : "files"} ready to process
              </span>
            </div>
            <span className="text-xs text-text-muted">
              {formatBytes(validFiles.reduce((a, b) => a + b.file.size, 0))}
            </span>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3 border-t border-border-subtle">
            {onReset && (
              <button
                type="button"
                onClick={onReset}
                className="px-4 py-2 text-xs font-medium text-text-muted hover:text-text-strong rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Clear files
              </button>
            )}

            <button
              type="button"
              onClick={onConvert}
              disabled={validFiles.length === 0}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-hover shadow-xs disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <Sparkles size={16} aria-hidden="true" />
              <span>{actionLabel}</span>
            </button>
          </div>
        </div>
      );

    case "processing":
      return (
        <div
          role="status"
          className={cn(
            "p-8 text-center rounded-2xl bg-surface border border-primary/30 shadow-md space-y-4",
            className
          )}
        >
          <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <Loader2 size={28} className="animate-spin" aria-hidden="true" />
          </div>

          <div>
            <h4 className="text-base font-bold text-text-strong">
              {processingMessage || "Processing your files..."}
            </h4>
            <p className="mt-1 text-xs text-text-muted">
              Fast, privacy-safe processing in progress. Please do not close this window.
            </p>
          </div>

          {onCancel && (
            <div className="pt-2">
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors cursor-pointer"
              >
                <Ban size={14} aria-hidden="true" />
                <span>Cancel processing</span>
              </button>
            </div>
          )}
        </div>
      );

    case "complete":
      return (
        <div
          role="region"
          aria-label="Conversion completed"
          aria-live="polite"
          className={cn(
            "p-6 sm:p-8 rounded-2xl bg-surface border border-emerald-200 shadow-md space-y-5",
            className
          )}
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 size={26} aria-hidden="true" />
            </div>
            <div>
              <h4 className="text-base sm:text-lg font-bold text-text-strong">
                Conversion Complete!
              </h4>
              <p className="text-xs text-text-muted">
                {resultFiles.length} {resultFiles.length === 1 ? "file" : "files"} ready for download.
              </p>
            </div>
          </div>

          {/* Results List */}
          <div className="space-y-2.5">
            {resultFiles.map((rf, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-gray-50 border border-border-subtle"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-text-strong truncate">{rf.name}</p>
                  <p className="text-xs text-text-muted">{formatBytes(rf.size)}</p>
                </div>

                {rf.blobUrl || rf.downloadUrl ? (
                  <a
                    href={rf.blobUrl || rf.downloadUrl}
                    download={rf.name}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-hover shadow-2xs transition-colors shrink-0"
                  >
                    <Download size={13} aria-hidden="true" />
                    <span>Download</span>
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => onDownloadSingle?.(rf)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-hover shadow-2xs transition-colors shrink-0 cursor-pointer"
                  >
                    <Download size={13} aria-hidden="true" />
                    <span>Download</span>
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-border-subtle flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <ShieldCheck size={14} className="text-emerald-600" aria-hidden="true" />
              <span>Temporary processing • See Privacy for retention details</span>
            </div>

            <div className="flex items-center gap-2.5">
              {resultFiles.length > 1 && onDownloadAll && (
                <button
                  type="button"
                  onClick={onDownloadAll}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-hover transition-colors cursor-pointer"
                >
                  <Download size={14} aria-hidden="true" />
                  <span>Download All (ZIP)</span>
                </button>
              )}

              {onReset && (
                <button
                  type="button"
                  onClick={onReset}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-100 text-text-strong text-xs font-semibold hover:bg-gray-200 transition-colors cursor-pointer"
                >
                  <RotateCcw size={14} aria-hidden="true" />
                  <span>Convert Another</span>
                </button>
              )}
            </div>
          </div>
        </div>
      );

    case "failed":
      return (
        <div
          role="alert"
          className={cn(
            "p-6 rounded-2xl bg-red-50/70 border border-red-200 shadow-xs space-y-4",
            className
          )}
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
              <AlertCircle size={22} aria-hidden="true" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-red-900">Conversion Failed</h4>
              <p className="mt-0.5 text-xs text-red-700">
                {errorMessage || "An unexpected error occurred during processing."}
              </p>
              {errorCode && (
                <span className="mt-2 inline-block font-mono text-[10px] text-red-800 bg-red-100 px-2 py-0.5 rounded">
                  Code: {errorCode}
                </span>
              )}
            </div>
          </div>

          {onReset && (
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={onReset}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors cursor-pointer"
              >
                <RotateCcw size={14} aria-hidden="true" />
                <span>Try again</span>
              </button>
            </div>
          )}
        </div>
      );

    case "cancelled":
      return (
        <div
          role="status"
          className={cn(
            "p-6 rounded-2xl bg-amber-50/70 border border-amber-200 shadow-xs space-y-3 text-center",
            className
          )}
        >
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
            <Ban size={20} aria-hidden="true" />
          </div>
          <h4 className="text-sm font-bold text-amber-900">Conversion Cancelled</h4>
          <p className="text-xs text-amber-700">Conversion cancelled. Any in-flight browser work will be discarded.</p>
          {onReset && (
            <div className="pt-2">
              <button
                type="button"
                onClick={onReset}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition-colors cursor-pointer"
              >
                <RotateCcw size={14} aria-hidden="true" />
                <span>Start over</span>
              </button>
            </div>
          )}
        </div>
      );

    case "expired":
      return (
        <div
          role="status"
          className={cn(
            "p-6 rounded-2xl bg-gray-50 border border-gray-200 shadow-xs space-y-3 text-center",
            className
          )}
        >
          <div className="w-10 h-10 rounded-xl bg-gray-200 text-gray-700 flex items-center justify-center mx-auto">
            <Clock size={20} aria-hidden="true" />
          </div>
          <h4 className="text-sm font-bold text-gray-900">Session Expired</h4>
          <p className="text-xs text-gray-600">
            For your privacy, temporary files are permanently cleared after expiration.
          </p>
          {onReset && (
            <div className="pt-2">
              <button
                type="button"
                onClick={onReset}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-hover transition-colors cursor-pointer"
              >
                <RotateCcw size={14} aria-hidden="true" />
                <span>New Conversion</span>
              </button>
            </div>
          )}
        </div>
      );

    case "idle":
    default:
      return null;
  }
}
