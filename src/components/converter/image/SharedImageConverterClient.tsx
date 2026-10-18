'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { UniversalUploader } from '@/components/uploader/UniversalUploader';
import { useConverterState, ConvertedResultFile } from '@/components/converter/useConverterState';
import { ConverterStateView } from '@/components/converter/ConverterStateView';
import { PrivacyBadge } from '@/components/tools/PrivacyBadge';
import {
  ConvertedImageResult,
  ImageCropOptions,
  ImageResizeOptions,
  ImageToPdfOptions,
  convertSingleImage,
  detectImageFormat,
  isValidImageFile,
  SupportedImageFormat,
  runBatchConversion,
  createBatchZip,
  revokeConvertedUrls,
} from '@/lib/converters/image';
import { ImageOptionsBar } from './ImageOptionsBar';
import { ImageVisualCropper } from './ImageVisualCropper';
import { Download, Archive, RefreshCw, Sparkles } from 'lucide-react';
import { formatBytes } from '@/lib/utils';

export type ConverterMode = 'convert' | 'resize' | 'compress' | 'crop' | 'pdf';

export interface SharedImageConverterClientProps {
  toolTitle: string;
  toolDescription: string;
  sourceFormats: string[]; // e.g. ['jpg', 'jpeg']
  targetFormat: 'png' | 'jpg' | 'webp' | 'pdf';
  targetMime: 'image/png' | 'image/jpeg' | 'image/webp' | 'application/pdf';
  mode?: ConverterMode;
  defaultQuality?: number;
  showBackgroundOption?: boolean;
}

export function SharedImageConverterClient({
  toolTitle,
  toolDescription,
  sourceFormats,
  targetFormat,
  targetMime,
  mode = 'convert',
  defaultQuality = 0.85,
  showBackgroundOption = false,
}: SharedImageConverterClientProps) {
  const [quality, setQuality] = useState<number>(defaultQuality);
  const [backgroundColor, setBackgroundColor] = useState<string>('#FFFFFF');
  const [resizeOptions, setResizeOptions] = useState<ImageResizeOptions>({ maintainAspectRatio: true });
  const [cropOptions, setCropOptions] = useState<ImageCropOptions>({ x: 0, y: 0, width: 0, height: 0 });
  const [compressTarget, setCompressTarget] = useState<'original' | 'webp'>('original');
  const [pdfOptions, setPdfOptions] = useState<ImageToPdfOptions>({
    pageSize: 'a4',
    orientation: 'auto',
    margin: 20,
    combine: true,
  });

  const [convertedResults, setConvertedResults] = useState<ConvertedImageResult[]>([]);
  const [failedFiles, setFailedFiles] = useState<Array<{ file: File; error: string }>>([]);
  const [uploaderKey, setUploaderKey] = useState(0);
  const generation = useRef(0);
  const busy = useRef(false);
  const [isZipping, setIsZipping] = useState(false);

  const { state, setFiles, startProcessing, setComplete, setFailed, reset: baseReset } =
    useConverterState();

  const resultsRef = useRef<ConvertedImageResult[]>([]);
  const zipUrlRef = useRef<string | null>(null);

  const cleanupUrls = useCallback(() => {
    revokeConvertedUrls(resultsRef.current, [zipUrlRef.current]);
    resultsRef.current = [];
    zipUrlRef.current = null;
  }, []);

  useEffect(() => () => { generation.current++; cleanupUrls(); }, [cleanupUrls]);
  const handleReset = () => {
    generation.current++;
    cleanupUrls();
    setConvertedResults([]);
    setFailedFiles([]);
    setCropOptions({ x: 0, y: 0, width: 0, height: 0 });
    setUploaderKey(k => k + 1);
    baseReset();
  };
  const receiveFiles = useCallback((files: Parameters<typeof setFiles>[0]) => {
    generation.current++;
    cleanupUrls();
    setConvertedResults([]);
    setFailedFiles([]);
    setFiles(files);
  }, [cleanupUrls, setFiles]);

  const validItems = state.files.filter((f) => f.status === 'valid');
  const validFiles = validItems.map((item) => item.file);

  const handleConvert = async () => {
    if (validFiles.length === 0 || busy.current) return;
    busy.current = true;
    const run = generation.current;
    const acceptResults = (results: ConvertedImageResult[]) => {
      if (run !== generation.current) { revokeConvertedUrls(results); return false; }
      resultsRef.current = results;
      setConvertedResults(results);
      return true;
    };

    cleanupUrls();
    setFailedFiles([]);
    startProcessing(`Preparing to convert ${validFiles.length} file(s)...`);

    try {
      if (mode === 'pdf') {
        const { convertImagesToPdf } = await import('@/lib/converters/image/pdfEncoder');
        const pdfOutputName =
          validFiles.length === 1
            ? `${validFiles[0].name.replace(/\.[a-zA-Z0-9]+$/i, '')}.pdf`
            : 'converted-document.pdf';

        const results = await convertImagesToPdf(validFiles, pdfOptions, pdfOutputName);
        if (!acceptResults(results)) return;

        const convertedResultFiles: ConvertedResultFile[] = results.map((r) => ({
          name: r.name,
          size: r.size,
          blobUrl: r.blobUrl,
          mimeType: 'application/pdf',
        }));
        setComplete(convertedResultFiles);
      } else if (mode === 'crop') {
        const file = validFiles[0];
        const result = await convertSingleImage(file, file.name, {
          targetExtension: targetFormat === 'pdf' ? 'png' : targetFormat,
          targetMime: targetMime === 'application/pdf' ? 'image/png' : targetMime,
          crop: cropOptions.width > 0 && cropOptions.height > 0 ? cropOptions : undefined,
          backgroundColor: targetFormat === 'jpg' ? backgroundColor : undefined,
        });
        if (!acceptResults([result])) return;

        setComplete([
          {
            name: result.name,
            size: result.size,
            blobUrl: result.blobUrl,
            mimeType: result.mimeType,
          },
        ]);
      } else {
        const batchResult = await runBatchConversion(
          validFiles,
          {},
          async (f) => {
            if (!await isValidImageFile(f, sourceFormats as SupportedImageFormat[])) {
              throw new Error('Image signature does not match the formats accepted by this tool.');
            }
            const detected = await detectImageFormat(f) as 'jpg' | 'png' | 'webp';
            const output = mode === 'resize' ? detected : mode === 'compress'
              ? (compressTarget === 'webp' ? 'webp' : detected)
              : targetFormat === 'pdf' ? 'png' : targetFormat;
            return convertSingleImage(f, f.name, {
              targetExtension: output,
              quality: output === 'png' ? undefined : quality,
              backgroundColor: output === 'jpg' ? backgroundColor : undefined,
              resize: mode === 'resize' ? resizeOptions : undefined,
            });
          },
          (completed, total, currentName) => {
            if (run === generation.current) startProcessing(`Converting ${completed} of ${total}: ${currentName || ''}`);
          },
          2 // Concurrency limit of 2 for memory safety
        );

        if (!acceptResults(batchResult.successful)) return;
        setFailedFiles(batchResult.failed);

        if (batchResult.successful.length > 0) {
          const convertedResultFiles: ConvertedResultFile[] = batchResult.successful.map((r) => ({
            name: r.name,
            size: r.size,
            blobUrl: r.blobUrl,
            mimeType: r.mimeType,
          }));
          setComplete(convertedResultFiles);
        } else {
          const firstError = batchResult.failed[0]?.error || 'Conversion failed for all files.';
          setFailed('CORRUPT_FILE', firstError);
        }
      }
    } catch (err) {
      if (run === generation.current) setFailed('CORRUPT_FILE', err instanceof Error ? err.message : 'Conversion failed unexpectedly.');
    } finally { busy.current = false; }
  };

  const handleDownloadZip = async () => {
    if (convertedResults.length <= 1 || isZipping) return;
    const run = generation.current;
    setIsZipping(true);
    try {
      const zip = await createBatchZip(convertedResults, `${targetFormat}-converted-bundle.zip`);
      if (run !== generation.current) { URL.revokeObjectURL(zip.url); return; }
      if (zipUrlRef.current) URL.revokeObjectURL(zipUrlRef.current);
      zipUrlRef.current = zip.url;
      const a = document.createElement('a');
      a.href = zip.url;
      a.download = zip.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      alert('Failed to generate ZIP archive.');
    } finally {
      setIsZipping(false);
    }
  };

  const hasPngInput = validFiles.some((f) => f.name.toLowerCase().endsWith('.png'));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Top Bar with Title & Privacy Badge */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-slate-100">
            {toolTitle}
          </h1>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">{toolDescription}</p>
        </div>
        <PrivacyBadge mode="client" />
      </div>

      {/* Step 1: Universal Uploader */}
      <fieldset disabled={state.status === 'processing'}>
      <UniversalUploader
        key={uploaderKey}
        multiple={mode !== 'crop'}
        allowedExtensions={sourceFormats}
        maxBatchCount={mode === 'crop' ? 1 : 20}
        maxFileBytes={50 * 1024 * 1024}
        onFilesChange={receiveFiles}
        disabled={state.status === 'processing'}
      />

      </fieldset>
      <p className="text-xs text-slate-600">Limit: 24 megapixels and 16,384 pixels per side. Still images only; animation and metadata are not retained. Output size may increase. Files stay on this device.</p>

      {/* Step 2: Tool Specific Options */}
      {validFiles.length > 0 && state.status !== 'complete' && state.status !== 'processing' && (
        <>
          {mode === 'crop' && validFiles[0] ? (
            <ImageVisualCropper key={validItems[0].id} file={validFiles[0]} crop={cropOptions} onChange={setCropOptions} />
          ) : (
            <ImageOptionsBar
              showQuality={mode === 'compress' || mode === 'resize' ? compressTarget === 'webp' || validFiles.some(f => !f.name.toLowerCase().endsWith('.png')) : targetFormat === 'jpg' || targetFormat === 'webp'}
              quality={quality}
              onQualityChange={setQuality}
              showBackground={showBackgroundOption || (mode === 'convert' && targetFormat === 'jpg')}
              backgroundColor={backgroundColor}
              onBackgroundChange={setBackgroundColor}
              showResize={mode === 'resize'}
              resize={resizeOptions}
              onResizeChange={setResizeOptions}
              showCompressNotice={mode === 'compress'}
              compressTarget={compressTarget}
              onCompressTargetChange={setCompressTarget}
              showPdfOptions={mode === 'pdf'}
              pdfOptions={pdfOptions}
              onPdfOptionsChange={setPdfOptions}
              hasPngInput={hasPngInput}
            />
          )}

          {/* Convert Action Trigger */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleConvert}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-indigo-700 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              <Sparkles className="h-4 w-4" />
              {mode === 'pdf'
                ? pdfOptions.combine
                  ? 'Convert All into 1 PDF'
                  : 'Convert to Separate PDFs'
                : mode === 'crop'
                ? 'Crop Image Now'
                : mode === 'resize' ? 'Resize Images'
                : mode === 'compress' ? 'Compress Images'
                : validFiles.length > 1
                ? `Convert ${validFiles.length} Files to ${targetFormat.toUpperCase()}`
                : `Convert to ${targetFormat.toUpperCase()}`}
            </button>
          </div>
        </>
      )}

      {/* Step 3: State Machine View (Processing / Completed / Failed) */}
      {(state.status === 'processing' || state.status === 'failed') && (
        <ConverterStateView
          state={state}
          onConvert={handleConvert}
          onReset={handleReset}
          onDownloadAll={handleDownloadZip}
        />
      )}

      {/* Step 4: Batch / Conversion Results List */}
      {state.status === 'complete' && convertedResults.length > 0 && (
        <div role="region" aria-label="Conversion completed" aria-live="polite" className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Conversion Results ({convertedResults.length} Successful
                {failedFiles.length > 0 && `, ${failedFiles.length} Failed`})
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                All selected files are processed in this browser.
              </p>
            </div>

            {convertedResults.length > 1 && (
              <button
                type="button"
                onClick={handleDownloadZip}
                disabled={isZipping}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-teal-700 disabled:opacity-50"
              >
                <Archive className="h-4 w-4" />
                {isZipping ? 'Generating ZIP...' : 'Download All as ZIP'}
              </button>
            )}
          </div>

          {failedFiles.length > 0 && <ul role="alert" className="text-sm text-red-700">{failedFiles.map((f, i) => <li key={i}>{f.file.name}: {f.error}</li>)}</ul>}
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {convertedResults.map((item, idx) => {
              const savings =
                item.originalSize > 0
                  ? Math.round(((item.originalSize - item.size) / item.originalSize) * 100)
                  : 0;

              return (
                <div
                  key={`${item.name}-${idx}`}
                  className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {item.name}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      <span>Original: {formatBytes(item.originalSize)}</span>
                      <span>&rarr;</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        Output: {formatBytes(item.size)}
                      </span>
                      {savings > 0 ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          {savings}% smaller
                        </span>
                      ) : <span>{savings < 0 ? `${Math.abs(savings)}% larger` : '0% reduction'}</span>}
                      {item.width && item.height && (
                        <span className="text-slate-400">
                          &bull; {item.width}×{item.height}px
                        </span>
                      )}
                    </div>
                  </div>

                  <a
                    href={item.blobUrl}
                    download={item.name}
                    className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    <Download className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                    Download
                  </a>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Convert more files
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
