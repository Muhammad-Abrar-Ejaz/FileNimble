export type PdfOperation = 'merge' | 'split' | 'extract' | 'delete' | 'organize' | 'rotate' | 'numbers' | 'watermark';
export type PdfToolMode = PdfOperation | 'jpg' | 'png';
export const PDF_LIMITS = { fileBytes: 25 * 1024 * 1024, batchBytes: 50 * 1024 * 1024, files: 10, pages: 200, outputs: 100, outputBytes: 100 * 1024 * 1024, renderPages: 40, pagePixels: 8_000_000, totalPixels: 64_000_000, workerMs: 30_000 } as const;
export interface PdfPageInfo { width: number; height: number; rotation: number }
export interface PdfInfo { name: string; pages: PdfPageInfo[] }
export interface PdfOutput { name: string; bytes: Uint8Array<ArrayBuffer>; mimeType: string }
export interface PdfOptions { operation: PdfOperation; pages?: number[]; groups?: number[][]; angle?: number; text?: string; startNumber?: number; position?: 'top' | 'bottom'; opacity?: number }
export type PdfRequest = { action: 'inspect'; files: File[] } | { action: 'convert'; files: File[]; options: PdfOptions };
export type PdfResponse = { ok: true; info?: PdfInfo[]; outputs?: PdfOutput[] } | { ok: false; error: string };
