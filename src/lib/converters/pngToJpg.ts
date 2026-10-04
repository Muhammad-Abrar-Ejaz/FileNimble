import { sanitizeFilename } from '@/lib/utils';
import {
  isPngFile as sharedIsPngFile,
  convertSingleImage,
  runBatchConversion,
  createBatchZip as sharedCreateBatchZip,
  revokeConvertedUrls as sharedRevokeConvertedUrls,
  ConvertedImageResult as SharedConvertedImageResult,
  BatchConversionResult as SharedBatchConversionResult,
} from './image';

export interface PngToJpgOptions {
  quality?: number; // 0.1 to 1.0 (default 0.85)
  backgroundColor?: string; // hex or CSS color (default #FFFFFF)
}

export type ConvertedImageResult = SharedConvertedImageResult;
export type BatchConversionResult = SharedBatchConversionResult;

/**
 * Validates whether a file is a valid PNG image using the shared signature checker.
 */
export async function isPngFile(file: File): Promise<boolean> {
  return sharedIsPngFile(file);
}

/**
 * Formats a clean, safe output JPG filename from an input filename.
 */
export function getOutputJpgFilename(filename: string): string {
  const basename = filename.split(/[/\\]/).pop() || filename;
  const base = basename.replace(/\.png$/i, '');
  const safeBase = sanitizeFilename(base);
  return `${safeBase || 'converted'}.jpg`;
}

/**
 * Converts a single PNG File to JPG directly in the browser using the shared Canvas engine.
 * Transparent pixels are flattened onto the specified background color.
 */
export async function convertPngToJpg(
  file: File,
  options: PngToJpgOptions = {}
): Promise<ConvertedImageResult> {
  const isPng = await isPngFile(file);
  if (!isPng) {
    throw new Error(`File "${file.name}" is not a valid PNG image.`);
  }

  return convertSingleImage(file, file.name, {
    targetExtension: 'jpg',
    targetMime: 'image/jpeg',
    quality: options.quality ?? 0.85,
    backgroundColor: options.backgroundColor || '#FFFFFF',
  });
}

/**
 * Converts a batch of PNG files with controlled concurrency.
 */
export async function convertPngBatch(
  files: File[],
  options: PngToJpgOptions = {},
  onProgress?: (completed: number, total: number, currentName: string) => void,
  concurrency = 2
): Promise<BatchConversionResult> {
  return runBatchConversion(
    files,
    options,
    (f, opts) => convertPngToJpg(f, opts),
    (completed, total, currentName) => onProgress?.(completed, total, currentName ?? ''),
    concurrency
  );
}

/**
 * Generates a ZIP archive containing all successfully converted JPG files.
 */
export async function createBatchZip(
  results: ConvertedImageResult[],
  zipFilename = 'filenimble-converted-images.zip'
): Promise<{ blob: Blob; url: string; blobUrl: string; filename: string }> {
  return sharedCreateBatchZip(results, zipFilename);
}

/**
 * Revokes blob URLs to prevent browser memory leaks.
 */
export function revokeConvertedUrls(results: ConvertedImageResult[]): void {
  sharedRevokeConvertedUrls(results);
}
