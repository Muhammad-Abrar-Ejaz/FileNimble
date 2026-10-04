import { sanitizeFilename } from '@/lib/utils';
import { decodeImage } from './decoder';
import { calculateResizeDimensions, clampCropBounds } from './transforms';
import { CommonImageConversionOptions, ConvertedImageResult } from './types';
import { detectImageFormat } from './signatures';

/**
 * Derives a sanitized target filename replacing extension.
 */
export function getOutputImageFilename(
  originalFilename: string,
  targetExtension: 'jpg' | 'png' | 'webp' | 'pdf'
): string {
  const basename = originalFilename.split(/[/\\]/).pop() || originalFilename;
  const baseWithoutExt = basename.replace(/\.[a-zA-Z0-9]+$/i, '');
  const safeBase = sanitizeFilename(baseWithoutExt);
  return `${safeBase || 'converted'}.${targetExtension === 'jpg' ? 'jpg' : targetExtension}`;
}

/**
 * Converts, resizes, crops, or re-encodes a single image file in the browser.
 */
export async function convertSingleImage(
  file: File | Blob,
  originalFilename: string,
  options: CommonImageConversionOptions
): Promise<ConvertedImageResult> {
  const detected = await detectImageFormat(file);
  if (!detected || !['jpg', 'png', 'webp'].includes(detected)) {
    throw new Error(`Unsupported or invalid image: "${originalFilename}".`);
  }
  if (options.backgroundColor && typeof CSS !== 'undefined' && !CSS.supports('color', options.backgroundColor)) {
    throw new Error('Enter a valid background color, such as #FFFFFF.');
  }
  const targetExtension = options.targetExtension || 'jpg';
  const targetMime =
    options.targetMime ||
    (targetExtension === 'png'
      ? 'image/png'
      : targetExtension === 'webp'
      ? 'image/webp'
      : 'image/jpeg');

  // Decode image source
  const decoded = await decodeImage(file, originalFilename);
  let canvas: HTMLCanvasElement | undefined;

  try {
    const srcW = decoded.width;
    const srcH = decoded.height;

    // 1. Determine crop source coordinates
    let sx = 0;
    let sy = 0;
    let sw = srcW;
    let sh = srcH;

    if (options.crop) {
      const clamped = clampCropBounds(srcW, srcH, options.crop);
      sx = clamped.x;
      sy = clamped.y;
      sw = clamped.width;
      sh = clamped.height;
    }

    // 2. Determine target output dimensions
    const { width: outW, height: outH } = calculateResizeDimensions(sw, sh, options.resize);

    // 3. Create canvas for rendering
    canvas = document.createElement('canvas');
    const renderCanvas = canvas;
    canvas.width = outW;
    canvas.height = outH;

    const ctx = canvas.getContext('2d', {
      alpha: targetMime !== 'image/jpeg',
    });

    if (!ctx) {
      throw new Error('Could not acquire 2D canvas context for image rendering.');
    }

    // 4. Fill background if target is JPEG (to flatten transparency) or if explicitly requested
    if (targetMime === 'image/jpeg' || options.backgroundColor) {
      ctx.fillStyle = options.backgroundColor || '#FFFFFF';
      ctx.fillRect(0, 0, outW, outH);
    }

    // 5. Draw image onto target canvas with high quality image smoothing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    decoded.drawTo(ctx, sx, sy, sw, sh, 0, 0, outW, outH);
    decoded.close();

    // 6. Encode to target MIME
    const blob = await new Promise<Blob>((resolve, reject) => {
      // NOTE: Standard browser canvas.toBlob ignores quality for "image/png"
      if (targetMime === 'image/png') {
        renderCanvas.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error(`PNG encoding failed for "${originalFilename}".`));
        }, 'image/png');
      } else {
        const quality = Math.min(Math.max(options.quality ?? 0.85, 0.1), 1.0);
        renderCanvas.toBlob(
          (b) => {
            if (b) resolve(b);
            else reject(new Error(`${targetMime} encoding failed for "${originalFilename}".`));
          },
          targetMime,
          quality
        );
      }
    });

    if (blob.type !== targetMime || await detectImageFormat(blob) !== targetExtension) {
      throw new Error(`This browser could not encode ${targetExtension.toUpperCase()} correctly.`);
    }

    // Clean up canvas memory immediately
    canvas.width = 0;
    canvas.height = 0;

    const outputName = getOutputImageFilename(originalFilename, targetExtension);
    const blobUrl = URL.createObjectURL(blob);

    return {
      name: outputName,
      size: blob.size,
      blob,
      blobUrl,
      mimeType: targetMime,
      originalName: originalFilename,
      originalSize: file.size,
      width: outW,
      height: outH,
    };
  } finally {
    if (canvas) { canvas.width = 0; canvas.height = 0; }
    decoded.close();
  }
}
