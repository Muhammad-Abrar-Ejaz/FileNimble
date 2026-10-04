import { ImageCropOptions, ImageResizeOptions } from './types';

/**
 * Calculates final dimensions for resizing while respecting aspect ratio and constraints.
 */
function resizeDimensions(
  srcWidth: number,
  srcHeight: number,
  options?: ImageResizeOptions
): { width: number; height: number } {
  if (!options) {
    return { width: srcWidth, height: srcHeight };
  }

  const { width: targetW, height: targetH, maintainAspectRatio = true, fit = 'contain' } = options;

  if (!targetW && !targetH) {
    return { width: srcWidth, height: srcHeight };
  }

  // If only width is specified
  if (targetW && !targetH) {
    if (!maintainAspectRatio) return { width: Math.round(targetW), height: srcHeight };
    const ratio = targetW / srcWidth;
    return { width: Math.round(targetW), height: Math.max(1, Math.round(srcHeight * ratio)) };
  }

  // If only height is specified
  if (!targetW && targetH) {
    if (!maintainAspectRatio) return { width: srcWidth, height: Math.round(targetH) };
    const ratio = targetH / srcHeight;
    return { width: Math.max(1, Math.round(srcWidth * ratio)), height: Math.round(targetH) };
  }

  // Both width and height are specified
  const tw = Math.max(1, Math.round(targetW!));
  const th = Math.max(1, Math.round(targetH!));

  if (!maintainAspectRatio || fit === 'fill') {
    return { width: tw, height: th };
  }

  const srcAspect = srcWidth / srcHeight;
  const targetAspect = tw / th;

  if (fit === 'contain') {
    if (srcAspect > targetAspect) {
      // Width is the limiting factor
      return { width: tw, height: Math.max(1, Math.round(tw / srcAspect)) };
    } else {
      // Height is the limiting factor
      return { width: Math.max(1, Math.round(th * srcAspect)), height: th };
    }
  }

  if (fit === 'cover') {
    if (srcAspect > targetAspect) {
      return { width: Math.max(1, Math.round(th * srcAspect)), height: th };
    } else {
      return { width: tw, height: Math.max(1, Math.round(tw / srcAspect)) };
    }
  }

  return { width: tw, height: th };
}

export const MAX_IMAGE_PIXELS = 24_000_000;
export const MAX_IMAGE_DIMENSION = 16384;

export function validateImageDimensions(width: number, height: number): void {
  if (![width, height].every((n) => Number.isFinite(n) && n >= 1 && n <= MAX_IMAGE_DIMENSION) || width * height > MAX_IMAGE_PIXELS) {
    throw new Error('Image dimensions must be positive, at most 16,384 per side and 24 megapixels total.');
  }
}

export function calculateResizeDimensions(srcWidth: number, srcHeight: number, options?: ImageResizeOptions) {
  validateImageDimensions(srcWidth, srcHeight);
  for (const value of [options?.width, options?.height]) {
    if (value !== undefined && (!Number.isFinite(value) || value < 1 || value > MAX_IMAGE_DIMENSION)) {
      throw new Error('Enter dimensions from 1 to 16,384 pixels.');
    }
  }
  let { width, height } = resizeDimensions(srcWidth, srcHeight, options);
  if (!options?.allowUpscale) {
    if (options?.maintainAspectRatio !== false && options?.fit !== 'fill') {
      const scale = Math.min(1, srcWidth / width, srcHeight / height);
      width = Math.max(1, Math.round(width * scale));
      height = Math.max(1, Math.round(height * scale));
    } else { width = Math.min(width, srcWidth); height = Math.min(height, srcHeight); }
  }
  validateImageDimensions(width, height);
  return { width, height };
}

/**
 * Validates and clamps crop coordinates to stay within image boundaries.
 */
export function clampCropBounds(
  srcWidth: number,
  srcHeight: number,
  crop: ImageCropOptions
): ImageCropOptions {
  validateImageDimensions(srcWidth, srcHeight);
  if (!Object.values(crop).every(Number.isFinite)) throw new Error('Crop coordinates must be finite numbers.');
  const x = Math.max(0, Math.min(Math.round(crop.x), srcWidth - 1));
  const y = Math.max(0, Math.min(Math.round(crop.y), srcHeight - 1));
  const width = Math.max(1, Math.min(Math.round(crop.width), srcWidth - x));
  const height = Math.max(1, Math.min(Math.round(crop.height), srcHeight - y));

  return { x, y, width, height };
}
