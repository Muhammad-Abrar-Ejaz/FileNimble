import { DecodedImage } from './types';
import { validateImageDimensions } from './transforms';

/**
 * Decodes an image File or Blob directly in browser memory.
 * Uses createImageBitmap if supported for GPU acceleration, with HTMLImageElement fallback.
 * Always call decoded.close() when finished to free GPU and RAM memory.
 */
export async function decodeImage(file: Blob, filename = 'image'): Promise<DecodedImage> {
  let imageBitmap: ImageBitmap | null = null;
  let htmlImage: HTMLImageElement | null = null;
  let objectUrlToRevoke: string | null = null;
  let width = 0;
  let height = 0;

  if (typeof window !== 'undefined' && 'createImageBitmap' in window) {
    try {
      imageBitmap = await createImageBitmap(file);
      width = imageBitmap.width;
      height = imageBitmap.height;
    } catch {
      // Fall through to HTMLImageElement fallback if createImageBitmap rejects
    }
  }

  if (!imageBitmap && typeof window !== 'undefined') {
    htmlImage = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      objectUrlToRevoke = objectUrl;

      img.onload = () => {
        resolve(img);
      };
      img.onerror = () => {
        if (objectUrlToRevoke) {
          URL.revokeObjectURL(objectUrlToRevoke);
          objectUrlToRevoke = null;
        }
        reject(new Error(`Failed to decode image data for "${filename}".`));
      };
      img.src = objectUrl;
    });

    width = htmlImage.naturalWidth || htmlImage.width;
    height = htmlImage.naturalHeight || htmlImage.height;
  }

  try { validateImageDimensions(width, height); } catch (error) {
    imageBitmap?.close();
    if (htmlImage) htmlImage.src = '';
    if (objectUrlToRevoke) {
      URL.revokeObjectURL(objectUrlToRevoke);
    }
    throw error;
  }

  return {
    width,
    height,
    drawTo: (ctx, sx, sy, sw, sh, dx, dy, dw, dh) => {
      if (imageBitmap) {
        ctx.drawImage(imageBitmap, sx, sy, sw, sh, dx, dy, dw, dh);
      } else if (htmlImage) {
        ctx.drawImage(htmlImage, sx, sy, sw, sh, dx, dy, dw, dh);
      }
    },
    close: () => {
      if (imageBitmap) {
        imageBitmap.close();
        imageBitmap = null;
      }
      if (objectUrlToRevoke) {
        URL.revokeObjectURL(objectUrlToRevoke);
        objectUrlToRevoke = null;
      }
      if (htmlImage) {
        htmlImage.src = '';
        htmlImage = null;
      }
    },
  };
}
