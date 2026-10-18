"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { formatBytes } from "@/lib/utils";
import {
  isExtensionAllowed,
  isMimePlausible,
  isFilenameSafe,
  validateMagicBytes,
  getExpectedMime,
} from "@/lib/validation";
import { FileRow, ValidatedFile } from "./FileRow";
import { UploadCloud, Plus, Trash2, AlertCircle, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export interface UniversalUploaderProps {
  onFilesChange?: (files: ValidatedFile[]) => void;
  allowedExtensions?: string[];
  allowedMimeTypes?: string[];
  maxFileBytes?: number;
  maxBatchCount?: number;
  multiple?: boolean;
  allowReorder?: boolean;
  title?: string;
  subtitle?: string;
  accept?: string;
  privacyLabel?: string;
  className?: string;
  disabled?: boolean;
}

export function UniversalUploader({
  onFilesChange,
  allowedExtensions,
  allowedMimeTypes,
  maxFileBytes = 50 * 1024 * 1024, // 50MB default
  maxBatchCount = 10,
  multiple = true,
  allowReorder = true,
  title = "Drop files here or click to upload",
  subtitle,
  accept,
  privacyLabel = "Check the tool’s label to see whether files stay in your browser or upload after you start conversion.",
  className,
  disabled = false,
}: UniversalUploaderProps) {
  const [files, setFilesState] = useState<ValidatedFile[]>([]);
  const filesRef = useRef<ValidatedFile[]>([]);
  const pendingCount = useRef(0);
  const generation = useRef(0);
  const setFiles = useCallback((update: React.SetStateAction<ValidatedFile[]>) => {
    filesRef.current = typeof update === "function" ? update(filesRef.current) : update;
    setFilesState(filesRef.current);
  }, []);
  const [isDragging, setIsDragging] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { generation.current++; }, []);

  // Notify parent on file change
  useEffect(() => {
    onFilesChange?.(files);
  }, [files, onFilesChange]);

  const validateSingleFile = useCallback(
    async (file: File): Promise<ValidatedFile> => {
      const id = `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 7)}`;

      // 1. Filename safety
      if (!isFilenameSafe(file.name)) {
        return {
          id,
          file,
          status: "unsafe_filename",
          statusMessage: "Unsafe characters in filename",
        };
      }

      // 2. Max file size
      if (file.size > maxFileBytes) {
        return {
          id,
          file,
          status: "too_large",
          statusMessage: `Exceeds max size (${formatBytes(maxFileBytes)})`,
        };
      }

      // 3. Zero byte file
      if (file.size === 0) {
        return {
          id,
          file,
          status: "corrupt",
          statusMessage: "File is empty (0 bytes)",
        };
      }

      // 4. Extension check
      if (allowedExtensions && allowedExtensions.length > 0) {
        if (!isExtensionAllowed(file.name, allowedExtensions)) {
          return {
            id,
            file,
            status: "unsupported_format",
            statusMessage: `Allowed: .${allowedExtensions.join(", .")}`,
          };
        }
      }

      // 5. Allowed MIME types check
      if (allowedMimeTypes && allowedMimeTypes.length > 0 && file.type) {
        if (!allowedMimeTypes.includes(file.type)) {
          return {
            id,
            file,
            status: "unsupported_format",
            statusMessage: "MIME type not allowed",
          };
        }
      }

      // 6. MIME plausibility
      if (file.type && !isMimePlausible(file.name, file.type)) {
        return {
          id,
          file,
          status: "mime_mismatch",
          statusMessage: "File type doesn't match extension",
        };
      }

      // 7. Magic bytes header inspection (first 64 bytes)
      try {
        const expectedMime = file.type || getExpectedMime(file.name);
        if (expectedMime) {
          const slice = file.slice(0, 64);
          const buffer = await slice.arrayBuffer();
          const header = new Uint8Array(buffer);
          if (!validateMagicBytes(header, expectedMime)) {
            return {
              id,
              file,
              status: "corrupt",
              statusMessage: "File header does not match declared type",
            };
          }
        }
      } catch {
        return { id, file, status: "corrupt", statusMessage: "Could not read file header. Please select the file again." };
      }

      return {
        id,
        file,
        status: "valid",
        statusMessage: "Ready",
      };
    },
    [maxFileBytes, allowedExtensions, allowedMimeTypes]
  );

  const handleIncomingFiles = useCallback(
    async (incoming: FileList | File[]) => {
      if (disabled) return;
      setBatchError(null);
      const incomingArray = Array.from(incoming);

      if (incomingArray.length === 0) return;

      if (!multiple) {
        // Single file mode: replace existing
        const run = ++generation.current;
        const single = incomingArray[0];
        const validated = await validateSingleFile(single);
        if (run === generation.current) setFiles([validated]);
        return;
      }

      if (filesRef.current.length + pendingCount.current + incomingArray.length > maxBatchCount) {
        setBatchError(`Maximum of ${maxBatchCount} files allowed per batch.`);
        return;
      }

      const run = generation.current;
      pendingCount.current += incomingArray.length;
      const validatedList = await Promise.all(
        incomingArray.map((f) => validateSingleFile(f))
      );
      if (run !== generation.current) return;
      pendingCount.current -= incomingArray.length;
      setFiles((prev) => [...prev, ...validatedList]);
    },
    [disabled, maxBatchCount, multiple, validateSingleFile, setFiles]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleIncomingFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleIncomingFiles(e.target.files);
      // Reset input value so re-selecting same file triggers change
      e.target.value = "";
    }
  };

  const handleRemove = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleClearAll = () => {
    generation.current++;
    pendingCount.current = 0;
    setFiles([]);
    setBatchError(null);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    setFiles((prev) => {
      const next = [...prev];
      const temp = next[index - 1];
      next[index - 1] = next[index];
      next[index] = temp;
      return next;
    });
  };

  const handleMoveDown = (index: number) => {
    if (index >= files.length - 1) return;
    setFiles((prev) => {
      const next = [...prev];
      const temp = next[index + 1];
      next[index + 1] = next[index];
      next[index] = temp;
      return next;
    });
  };

  const totalSize = files.reduce((acc, curr) => acc + curr.file.size, 0);
  const validFilesCount = files.filter((f) => f.status === "valid").length;

  return (
    <div className={cn("w-full max-w-2xl mx-auto", className)}>
      {/* Hidden Native Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple={multiple}
        accept={
          accept ||
          (allowedExtensions ? allowedExtensions.map((e) => `.${e}`).join(",") : undefined)
        }
        onChange={handleFileInputChange}
        disabled={disabled}
        tabIndex={-1}
        className="sr-only"
        aria-label="Upload files"
      />

      {/* Drop Zone Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (!disabled && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-label={title}
        className={cn(
          "relative flex flex-col items-center justify-center p-8 sm:p-10 rounded-3xl border-2 border-dashed transition-all cursor-pointer select-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          isDragging
            ? "border-primary bg-primary/5 scale-[1.01] shadow-md"
            : "border-border-subtle bg-surface hover:border-primary/50 hover:bg-gray-50/50 shadow-xs",
          disabled && "opacity-50 cursor-not-allowed pointer-events-none"
        )}
      >
        <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
          <UploadCloud size={28} aria-hidden="true" />
        </div>

        <h2 className="text-base sm:text-lg font-bold text-text-strong text-center">
          {title}
        </h2>

        <p className="mt-1 text-xs sm:text-sm text-text-muted text-center max-w-md">
          {subtitle ||
            (allowedExtensions && allowedExtensions.length > 0
              ? `Supported formats: ${allowedExtensions.map((e) => `.${e}`).join(", ")}`
              : "Drag & drop your files here or click to browse")}
        </p>

        <div className="mt-4 flex items-center gap-3">
          <span
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-hover shadow-xs transition-colors pointer-events-none"
          >
            <Plus size={16} aria-hidden="true" />
            <span>Choose Files</span>
          </span>
        </div>

        <div className="mt-4 flex items-center gap-4 text-[11px] sm:text-xs text-text-muted">
          <span>Max {formatBytes(maxFileBytes)} per file</span>
          <span>•</span>
          <span>Up to {maxBatchCount} files</span>
        </div>
      </div>

      {/* Batch Error Banner */}
      {batchError && (
        <div
          role="alert"
          className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2"
        >
          <AlertCircle size={16} className="shrink-0 text-red-600" />
          <span>{batchError}</span>
        </div>
      )}

      {/* File List Section */}
      {files.length > 0 && (
        <fieldset disabled={disabled} className="mt-6 space-y-3 min-w-0">
          <div className="flex items-center justify-between text-xs text-text-muted px-1">
            <span>
              <strong>{files.length}</strong> {files.length === 1 ? "file" : "files"} selected (
              {formatBytes(totalSize)}) • <strong>{validFilesCount}</strong> valid
            </span>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-primary hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus size={12} /> Add more
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="text-text-muted hover:text-red-600 font-medium inline-flex items-center gap-1 cursor-pointer"
              >
                <Trash2 size={12} /> Clear all
              </button>
            </div>
          </div>

          <div
            className="space-y-2 max-h-72 overflow-y-auto pr-1"
            role="region"
            aria-label="Selected file list"
          >
            {files.map((item, index) => (
              <FileRow
                key={item.id}
                item={item}
                index={index}
                totalCount={files.length}
                onRemove={handleRemove}
                onMoveUp={handleMoveUp}
                onMoveDown={handleMoveDown}
                allowReorder={allowReorder}
              />
            ))}
          </div>
        </fieldset>
      )}

      {/* Processing information footer */}
      <div className="mt-4 flex items-center justify-center gap-2 text-xs text-text-muted">
        <ShieldCheck size={14} className="text-emerald-600 shrink-0" aria-hidden="true" />
        <span>{privacyLabel}</span>
      </div>
    </div>
  );
}
