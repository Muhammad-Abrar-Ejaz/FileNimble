"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { UniversalUploader } from "@/components/uploader/UniversalUploader";
import { useConverterState, ConvertedResultFile } from "./useConverterState";
import { ConverterStateView } from "./ConverterStateView";
import { PngToJpgOptions } from "./PngToJpgOptions";
import { PrivacyBadge } from "@/components/tools/PrivacyBadge";
import {
  convertPngBatch,
  createBatchZip,
  revokeConvertedUrls,
  ConvertedImageResult,
} from "@/lib/converters/pngToJpg";
import { FileImage, ShieldCheck, Sparkles, AlertTriangle } from "lucide-react";

export function PngToJpgConverterClient() {
  const [quality, setQuality] = useState(0.85);
  const [uploaderKey, setUploaderKey] = useState(0);
  const [backgroundColor, setBackgroundColor] = useState("#FFFFFF");
  const [lastResults, setLastResults] = useState<ConvertedImageResult[]>([]);
  const [batchFailures, setBatchFailures] = useState<
    Array<{ file: File; error: string }>
  >([]);

  const resultsRef = useRef<ConvertedImageResult[]>([]);
  const generation = useRef(0);

  const {
    state,
    setFiles,
    startProcessing,
    setComplete,
    setFailed,
    cancel,
    reset: baseReset,
  } = useConverterState();

  // Clean up blob URLs on unmount or reset
  const cleanupUrls = useCallback(() => {
    if (resultsRef.current.length > 0) {
      revokeConvertedUrls(resultsRef.current);
      resultsRef.current = [];
    }
  }, []);

  useEffect(() => {
    const lifecycle = generation;
    return () => {
      lifecycle.current++;
      cleanupUrls();
    };
  }, [cleanupUrls]);

  const handleReset = () => {
    generation.current++;
    cleanupUrls();
    setLastResults([]);
    setBatchFailures([]);
    setUploaderKey(key => key + 1);
    baseReset();
  };

  const handleCancel = () => {
    generation.current++;
    cancel();
  };

  const handleConvert = async () => {
    const validItems = state.files.filter((f) => f.status === "valid");
    if (validItems.length === 0) return;
    const run = generation.current;
    cleanupUrls();

    setBatchFailures([]);
    startProcessing(`Preparing to convert ${validItems.length} file(s)...`);

    try {
      const filesToConvert = validItems.map((item) => item.file);

      const batchResult = await convertPngBatch(
        filesToConvert,
        { quality, backgroundColor },
        (completed, total, currentName) => {
          if (run === generation.current && completed < total) {
            startProcessing(
              `Converting ${completed + 1} of ${total}: ${currentName}`
            );
          }
        },
        2 // Concurrency limit
      );

      if (run !== generation.current) { revokeConvertedUrls(batchResult.successful); return; }
      resultsRef.current = batchResult.successful;
      setLastResults(batchResult.successful);
      setBatchFailures(batchResult.failed);

      if (batchResult.successful.length > 0) {
        const convertedFiles: ConvertedResultFile[] = batchResult.successful.map(
          (item) => ({
            name: item.name,
            size: item.size,
            blobUrl: item.blobUrl,
            mimeType: "image/jpeg",
          })
        );
        setComplete(convertedFiles);
      } else {
        setFailed(
          "CORRUPT_FILE",
          batchResult.failed[0]?.error || "All conversions failed."
        );
      }
    } catch (err) {
      if (run !== generation.current) return;
      setFailed(
        "CORRUPT_FILE",
        (err as Error).message || "An unexpected conversion error occurred."
      );
    }
  };

  const handleDownloadAllZip = async () => {
    if (lastResults.length === 0) return;
    const run = generation.current;
    try {
      const zipData = await createBatchZip(
        lastResults,
        "filenimble-png-to-jpg.zip"
      );
      if (run !== generation.current) { URL.revokeObjectURL(zipData.blobUrl); return; }
      const tempLink = document.createElement("a");
      tempLink.href = zipData.blobUrl;
      tempLink.download = zipData.filename;
      document.body.appendChild(tempLink);
      tempLink.click();
      document.body.removeChild(tempLink);
      URL.revokeObjectURL(zipData.blobUrl);
    } catch {
      alert("Failed to generate ZIP archive. Please download files individually.");
    }
  };

  const handleDownloadSingle = (file: ConvertedResultFile) => {
    if (!file.blobUrl) return;
    const tempLink = document.createElement("a");
    tempLink.href = file.blobUrl;
    tempLink.download = file.name;
    document.body.appendChild(tempLink);
    tempLink.click();
    document.body.removeChild(tempLink);
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Tool Header Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-surface border border-border-subtle shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-amber-50 border border-amber-200/60 flex items-center justify-center shrink-0">
              <FileImage size={26} className="text-amber-600" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                  Image Converter
                </span>
                <PrivacyBadge mode="client" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-text-strong tracking-tight">
                PNG to JPG Converter
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-text-muted">
                Convert PNG images into high-quality JPG format directly in your browser. Choose custom transparency backgrounds and compression levels.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Converter Workflow Area */}
      {state.status === "idle" || state.status === "ready" ? (
        <div className="space-y-6">
          <UniversalUploader
            key={uploaderKey}
            allowedExtensions={["png"]}
            allowedMimeTypes={["image/png"]}
            maxBatchCount={20}
            maxFileBytes={50 * 1024 * 1024}
            title="Drop PNG images here or click to browse"
            subtitle="Select one or multiple PNG images. Files are converted locally on your device."
            privacyLabel="This conversion runs in your browser; FileNimble does not upload the selected image."
            onFilesChange={setFiles}
          />

          {/* Configuration Options (Visible when files are added) */}
          {state.status === "ready" && (
            <div className="p-6 rounded-2xl bg-surface border border-border-subtle shadow-xs">
              <h3 className="text-sm font-bold text-text-strong mb-4 flex items-center gap-2">
                <Sparkles size={16} className="text-primary" />
                <span>Conversion Settings</span>
              </h3>

              <PngToJpgOptions
                quality={quality}
                onQualityChange={setQuality}
                backgroundColor={backgroundColor}
                onBackgroundColorChange={setBackgroundColor}
              />
            </div>
          )}

          {state.status === "ready" && (
            <ConverterStateView
              state={state}
              onConvert={handleConvert}
              onReset={handleReset}
              actionLabel="Convert to JPG"
            />
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <ConverterStateView
            state={state}
            onConvert={handleConvert}
            onCancel={handleCancel}
            onReset={handleReset}
            onDownloadSingle={handleDownloadSingle}
            onDownloadAll={handleDownloadAllZip}
            actionLabel="Convert to JPG"
          />

          {/* Partial Failure Notice if some files in batch failed */}
          {batchFailures.length > 0 && state.status === "complete" && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2">
              <AlertTriangle size={16} className="shrink-0 text-amber-600 mt-0.5" />
              <div>
                <p className="font-semibold">
                  {batchFailures.length} file(s) could not be converted:
                </p>
                <ul className="list-disc list-inside mt-1 space-y-0.5">
                  {batchFailures.map((f, i) => (
                    <li key={i}>
                      <strong>{f.file.name}:</strong> {f.error}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Trust Notice */}
      <div className="flex items-center justify-center gap-2 text-xs text-text-muted py-2">
        <ShieldCheck size={14} className="text-emerald-600 shrink-0" aria-hidden="true" />
        <span>Client-side execution • Original PNG images never leave your computer</span>
      </div>
    </div>
  );
}
