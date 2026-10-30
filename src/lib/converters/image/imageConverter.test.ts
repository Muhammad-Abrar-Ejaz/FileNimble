import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  detectImageFormat,
  isValidImageFile,
  calculateResizeDimensions,
  clampCropBounds,
  getOutputImageFilename,
  convertSingleImage,
  getHeicCapabilityReport,
} from './index';
import { convertImagesToPdf } from './pdfEncoder';

describe('Shared Image Engine - Signatures & Magic Bytes', () => {
  it('detects PNG signature', async () => {
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0]);
    const file = new File([pngBytes], 'sample.png', { type: 'image/png' });
    expect(await detectImageFormat(file)).toBe('png');
    expect(await isValidImageFile(file, ['png'])).toBe(true);
    expect(await isValidImageFile(file, ['jpg'])).toBe(false);
  });

  it('detects JPEG signature', async () => {
    const jpgBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 0, 0, 0, 0, 0]);
    const file = new File([jpgBytes], 'photo.jpg', { type: 'image/jpeg' });
    expect(await detectImageFormat(file)).toBe('jpg');
    expect(await isValidImageFile(file, ['jpg', 'jpeg'])).toBe(true);
  });

  it('detects WebP signature', async () => {
    const webpBytes = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, // RIFF
      0x24, 0x00, 0x00, 0x00,
      0x57, 0x45, 0x42, 0x50, // WEBP
      0x56, 0x50, 0x38, 0x20, // VP8
    ]);
    const file = new File([webpBytes], 'graphic.webp', { type: 'image/webp' });
    expect(await detectImageFormat(file)).toBe('webp');
    expect(await isValidImageFile(file, ['webp'])).toBe(true);
  });

  it('detects GIF signature', async () => {
    const gifBytes = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const file = new File([gifBytes], 'animation.gif', { type: 'image/gif' });
    expect(await detectImageFormat(file)).toBe('gif');
    expect(await isValidImageFile(file, ['gif'])).toBe(true);
    expect(await isValidImageFile(file, ['png'])).toBe(false);
  });

  it('detects BMP signature', async () => {
    const bmpBytes = new Uint8Array([0x42, 0x4d, 0x36, 0, 0, 0, 0, 0, 0, 0, 0x36, 0, 0, 0, 0x28, 0]);
    const file = new File([bmpBytes], 'bitmap.bmp', { type: 'image/bmp' });
    expect(await detectImageFormat(file)).toBe('bmp');
    expect(await isValidImageFile(file, ['bmp'])).toBe(true);
    expect(await isValidImageFile(file, ['jpg'])).toBe(false);
  });

  it('detects HEIC signature', async () => {
    const heicBytes = new Uint8Array([
      0x00, 0x00, 0x00, 0x18,
      0x66, 0x74, 0x79, 0x70, // ftyp
      0x68, 0x65, 0x69, 0x63, // heic
      0x00, 0x00, 0x00, 0x00,
    ]);
    const file = new File([heicBytes], 'photo.heic', { type: 'image/heic' });
    expect(await detectImageFormat(file)).toBe('heic');
  });

  it('rejects invalid or too short files', async () => {
    const dummy = new File([new Uint8Array([1, 2, 3])], 'corrupt.dat');
    expect(await detectImageFormat(dummy)).toBeNull();
  });
});

describe('Shared Image Engine - Filename Sanitization', () => {
  it('correctly replaces extension and cleans path traversal', () => {
    expect(getOutputImageFilename('../../path/photo.jpeg', 'png')).toBe('photo.png');
    expect(getOutputImageFilename('graphic.png', 'webp')).toBe('graphic.webp');
    expect(getOutputImageFilename('scan.webp', 'jpg')).toBe('scan.jpg');
    expect(getOutputImageFilename('document.jpg', 'pdf')).toBe('document.pdf');
  });
});

describe('Shared Image Engine - Resize & Crop Math', () => {
  it('calculates proportional resize with single dimension', () => {
    const res = calculateResizeDimensions(1000, 500, { width: 500, maintainAspectRatio: true });
    expect(res).toEqual({ width: 500, height: 250 });

    const resH = calculateResizeDimensions(1000, 500, { height: 200, maintainAspectRatio: true });
    expect(resH).toEqual({ width: 400, height: 200 });
  });

  it('handles contain vs cover fits', () => {
    const contain = calculateResizeDimensions(1000, 500, {
      width: 400,
      height: 400,
      fit: 'contain',
      maintainAspectRatio: true,
    });
    expect(contain).toEqual({ width: 400, height: 200 });

    const fill = calculateResizeDimensions(1000, 500, {
      width: 400,
      height: 400,
      fit: 'fill',
      maintainAspectRatio: true,
    });
    expect(fill).toEqual({ width: 400, height: 400 });
  });

  it('clamps crop coordinates within boundaries', () => {
    const clamped = clampCropBounds(1000, 800, { x: -50, y: 900, width: 2000, height: 500 });
    expect(clamped.x).toBe(0);
    expect(clamped.y).toBe(799);
    expect(clamped.width).toBe(1000);
    expect(clamped.height).toBe(1);
  });
});

describe('Shared Image Engine - Mock Canvas Conversion', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    // Mock createImageBitmap
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({
      width: 800,
      height: 600,
      close: vi.fn(),
    }));

    // Mock document.createElement for canvas
    const origCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName.toLowerCase() === 'canvas') {
        const mockCtx = {
          fillStyle: '',
          fillRect: vi.fn(),
          drawImage: vi.fn(),
          imageSmoothingEnabled: false,
          imageSmoothingQuality: 'low',
        };

        return {
          width: 800,
          height: 600,
          getContext: vi.fn().mockReturnValue(mockCtx),
          toBlob: (cb: (b: Blob | null) => void, mime = 'image/jpeg', quality?: number) => {
            expect(quality === undefined || (quality >= 0.1 && quality <= 1)).toBe(true);
            const signatures = { 'image/png': [137,80,78,71,13,10,26,10], 'image/jpeg': [255,216,255], 'image/webp': [82,73,70,70,0,0,0,0,87,69,66,80] };
            const fakeBlob = new Blob([new Uint8Array(signatures[mime as keyof typeof signatures])], { type: mime });
            cb(fakeBlob);
          },
        } as unknown as HTMLCanvasElement;
      }
      return origCreateElement(tagName);
    });

    // Mock URL.createObjectURL / revokeObjectURL
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn().mockReturnValue('blob:http://localhost/fake-uuid'),
      revokeObjectURL: vi.fn(),
    });
  });

  it('converts to WebP with requested quality', async () => {
    const dummy = new File([new Uint8Array([255,216,255])], 'photo.jpg', { type: 'image/jpeg' });
    const result = await convertSingleImage(dummy, 'photo.jpg', {
      targetExtension: 'webp',
      targetMime: 'image/webp',
      quality: 0.8,
    });

    expect(result.name).toBe('photo.webp');
    expect(result.mimeType).toBe('image/webp');
    expect(result.width).toBe(800);
    expect(result.height).toBe(600);
  });

  it('converts JPG to PNG producing opaque PNG with correct extension', async () => {
    const dummy = new File([new Uint8Array([255,216,255])], 'picture.jpg', { type: 'image/jpeg' });
    const result = await convertSingleImage(dummy, 'picture.jpg', {
      targetExtension: 'png',
      targetMime: 'image/png',
    });

    expect(result.name).toBe('picture.png');
    expect(result.mimeType).toBe('image/png');
  });

  it('converts WebP to JPG flattening background onto canvas', async () => {
    const dummy = new File([new Uint8Array([255,216,255])], 'icon.webp', { type: 'image/webp' });
    const result = await convertSingleImage(dummy, 'icon.webp', {
      targetExtension: 'jpg',
      targetMime: 'image/jpeg',
      backgroundColor: '#000000',
    });

    expect(result.name).toBe('icon.jpg');
    expect(result.mimeType).toBe('image/jpeg');
  });

  it('converts BMP to JPG and BMP to PNG', async () => {
    const bmpBytes = new Uint8Array([0x42, 0x4d, 0x36, 0, 0, 0, 0, 0, 0, 0, 0x36, 0, 0, 0, 0x28, 0]);
    const dummy = new File([bmpBytes], 'sample.bmp', { type: 'image/bmp' });

    const toJpg = await convertSingleImage(dummy, 'sample.bmp', {
      targetExtension: 'jpg',
      targetMime: 'image/jpeg',
      backgroundColor: '#FFFFFF',
    });
    expect(toJpg.name).toBe('sample.jpg');
    expect(toJpg.mimeType).toBe('image/jpeg');

    const toPng = await convertSingleImage(dummy, 'sample.bmp', {
      targetExtension: 'png',
      targetMime: 'image/png',
    });
    expect(toPng.name).toBe('sample.png');
    expect(toPng.mimeType).toBe('image/png');
  });

  it('converts GIF to JPG and GIF to PNG', async () => {
    const gifBytes = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const dummy = new File([gifBytes], 'sample.gif', { type: 'image/gif' });

    const toJpg = await convertSingleImage(dummy, 'sample.gif', {
      targetExtension: 'jpg',
      targetMime: 'image/jpeg',
      backgroundColor: '#FFFFFF',
    });
    expect(toJpg.name).toBe('sample.jpg');
    expect(toJpg.mimeType).toBe('image/jpeg');

    const toPng = await convertSingleImage(dummy, 'sample.gif', {
      targetExtension: 'png',
      targetMime: 'image/png',
    });
    expect(toPng.name).toBe('sample.png');
    expect(toPng.mimeType).toBe('image/png');
  });
});

describe('Shared Image Engine - Image to PDF', () => {
  it('converts image files to a single combined PDF document with PDF magic bytes', async () => {
    // Valid 1x1 PNG bytes in base64
    const validPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const pngBinary = Uint8Array.from(atob(validPngBase64), (c) => c.charCodeAt(0));

    const file1 = new File([pngBinary], 'page1.png', { type: 'image/png' });
    const file2 = new File([pngBinary], 'page2.png', { type: 'image/png' });

    // Mock decodeImage
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({
      width: 600,
      height: 800,
      close: vi.fn(),
    }));

    const results = await convertImagesToPdf([file1, file2], {
      pageSize: 'a4',
      combine: true,
    }, 'my-album.pdf');

    expect(results.length).toBe(1);
    expect(results[0].name).toBe('my-album.pdf');
    expect(results[0].mimeType).toBe('application/pdf');

    // Validate PDF magic bytes: %PDF- (0x25, 0x50, 0x44, 0x46, 0x2D)
    const arrayBuffer = await results[0].blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const pdfHeader = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3], bytes[4]);
    expect(pdfHeader).toBe('%PDF-');
  });
});

describe('Shared Image Engine - HEIC Capability Report', () => {
  it('returns valid capability report with planned status', async () => {
    const report = await getHeicCapabilityReport();
    expect(report.status).toBe('planned');
    expect(report.nativeSupported).toBeNull();
    expect(typeof report.notes).toBe('string');
  });
});
