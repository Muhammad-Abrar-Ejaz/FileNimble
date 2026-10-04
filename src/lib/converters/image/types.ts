export type SupportedImageFormat = 'jpg' | 'jpeg' | 'png' | 'webp' | 'gif' | 'bmp';
export type TargetImageFormat = 'jpg' | 'png' | 'webp' | 'pdf';

export interface ConvertedImageResult {
  name: string;
  size: number;
  blob: Blob;
  blobUrl: string;
  mimeType: string;
  originalName: string;
  originalSize: number;
  width?: number;
  height?: number;
}

export interface BatchConversionResult {
  successful: ConvertedImageResult[];
  failed: Array<{ file: File; error: string }>;
}

export interface ImageResizeOptions {
  width?: number;
  height?: number;
  maintainAspectRatio?: boolean;
  allowUpscale?: boolean;
  fit?: 'contain' | 'cover' | 'fill';
}

export interface ImageCropOptions {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CommonImageConversionOptions {
  quality?: number; // 0.1 to 1.0 for lossy formats (JPEG/WebP)
  backgroundColor?: string; // Hex color for flattening alpha when saving to JPEG
  resize?: ImageResizeOptions;
  crop?: ImageCropOptions;
  targetMime?: 'image/jpeg' | 'image/png' | 'image/webp';
  targetExtension?: 'jpg' | 'png' | 'webp';
}

export interface ImageToPdfOptions {
  pageSize?: 'fit' | 'a4' | 'letter';
  orientation?: 'portrait' | 'landscape' | 'auto';
  margin?: number; // Margin in points (default: 20)
  combine?: boolean; // If true and multiple images, generate 1 PDF with multiple pages
}

export interface DecodedImage {
  width: number;
  height: number;
  drawTo: (
    ctx: CanvasRenderingContext2D,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number
  ) => void;
  close: () => void;
}
