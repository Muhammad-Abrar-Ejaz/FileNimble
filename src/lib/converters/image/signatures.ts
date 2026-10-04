import { SupportedImageFormat } from './types';

/**
 * Detects the real image format of a File/Blob using magic bytes.
 */
export async function detectImageFormat(file: Blob): Promise<SupportedImageFormat | 'heic' | null> {
  if (!file || file.size < 3) return null;
  try {
    const slice = file.slice(0, 16);
    const buffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // 1. PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    ) {
      return 'png';
    }

    // 2. JPEG: FF D8 FF
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return 'jpg';
    }

    // 3. WebP: 52 49 46 46 (RIFF) ... 57 45 42 50 (WEBP)
    if (
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    ) {
      return 'webp';
    }

    // 4. GIF: 47 49 46 38 ("GIF8")
    if (
      bytes[0] === 0x47 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x38
    ) {
      return 'gif';
    }

    // 5. BMP: 42 4D ("BM")
    if (bytes[0] === 0x42 && bytes[1] === 0x4d) {
      return 'bmp';
    }

    // 6. HEIC / HEIF: bytes 4-7 are 'ftyp' and 8-11 are 'heic', 'heix', 'mif1', 'msf1'
    if (
      bytes[4] === 0x66 &&
      bytes[5] === 0x74 &&
      bytes[6] === 0x79 &&
      bytes[7] === 0x70
    ) {
      const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
      if (['heic', 'heix', 'hevc', 'heim', 'heis', 'mif1', 'msf1'].includes(brand.toLowerCase())) {
        return 'heic';
      }
    }

    return null;
  } catch {
    return null;
  }
}

export async function isPngFile(file: Blob): Promise<boolean> {
  return (await detectImageFormat(file)) === 'png';
}

export async function isJpgFile(file: Blob): Promise<boolean> {
  return (await detectImageFormat(file)) === 'jpg';
}

export async function isWebpFile(file: Blob): Promise<boolean> {
  return (await detectImageFormat(file)) === 'webp';
}

export async function isHeicFile(file: Blob): Promise<boolean> {
  return (await detectImageFormat(file)) === 'heic';
}

export async function isValidImageFile(
  file: Blob,
  allowedFormats: SupportedImageFormat[]
): Promise<boolean> {
  const detected = await detectImageFormat(file);
  if (!detected || detected === 'heic') return false;
  if (detected === 'jpg' && allowedFormats.includes('jpeg')) return true;
  return allowedFormats.includes(detected as SupportedImageFormat);
}
