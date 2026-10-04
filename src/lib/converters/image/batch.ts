import { BatchConversionResult, ConvertedImageResult } from './types';
import { sanitizeFilename } from '@/lib/utils';

/**
 * Runs a batch conversion over multiple files with a strict concurrency limit.
 * Concurrency defaults to 2 to prevent high memory spikes or tab crashes in browser.
 */
export async function runBatchConversion<TOptions>(
  files: File[],
  options: TOptions,
  convertSingleFn: (file: File, options: TOptions) => Promise<ConvertedImageResult>,
  onProgress?: (completed: number, total: number, currentName?: string) => void,
  concurrency = 2
): Promise<BatchConversionResult> {
  const ordered: Array<ConvertedImageResult | undefined> = new Array(files.length);
  const failed: Array<{ file: File; error: string }> = [];

  let nextIndex = 0;
  let completedCount = 0;
  const total = files.length;

  async function worker(): Promise<void> {
    while (nextIndex < total) {
      const currentIndex = nextIndex++;
      const file = files[currentIndex];
      try {
        const result = await convertSingleFn(file, options);
        ordered[currentIndex] = result;
      } catch (err) {
        failed.push({
          file,
          error: err instanceof Error ? err.message : 'Unknown conversion error',
        });
      } finally {
        completedCount++;
        onProgress?.(completedCount, total, file.name);
      }
    }
  }

  const workerCount = Math.min(Number.isFinite(concurrency) ? Math.max(1, Math.min(2, Math.floor(concurrency))) : 2, files.length);
  const workers = Array.from({ length: workerCount }, () => worker());
  await Promise.all(workers);

  // Maintain original input file order in successful array where possible
  const successful = ordered.filter((result): result is ConvertedImageResult => !!result);

  return { successful, failed };
}

/**
 * Packages all successfully converted results into a downloadable ZIP archive.
 */
export async function createBatchZip(
  results: ConvertedImageResult[],
  zipFilename = 'converted-images.zip'
): Promise<{ blob: Blob; url: string; blobUrl: string; filename: string }> {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();

  // Deduplicate filenames inside the zip
  const usedNames = new Set<string>();

  for (const item of results) {
    const safeName = sanitizeFilename(item.name.split(/[/\\]/).pop() || 'image');
    let finalName = safeName;
    let count = 0;
    while (usedNames.has(finalName.toLowerCase())) {
      const dotIdx = safeName.lastIndexOf('.');
      count++;
      finalName = dotIdx > 0 ? `${safeName.slice(0, dotIdx)}-${count}${safeName.slice(dotIdx)}` : `${safeName}-${count}`;
    }
    usedNames.add(finalName.toLowerCase());

    zip.file(finalName, item.blob);
  }

  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const url = URL.createObjectURL(zipBlob);
  return { blob: zipBlob, url, blobUrl: url, filename: zipFilename };
}

/**
 * Revokes all object URLs generated during conversion to free memory.
 */
export function revokeConvertedUrls(
  results: ConvertedImageResult[],
  extraUrls?: (string | null | undefined)[]
): void {
  for (const item of results) {
    if (item.blobUrl) {
      URL.revokeObjectURL(item.blobUrl);
    }
  }
  if (extraUrls) {
    for (const url of extraUrls) {
      if (url) {
        URL.revokeObjectURL(url);
      }
    }
  }
}
