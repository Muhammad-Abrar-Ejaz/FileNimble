import { sanitizeFilename } from '@/lib/utils';
import { decodeImage } from './decoder';
import { detectImageFormat } from './signatures';
import { ConvertedImageResult, ImageToPdfOptions } from './types';

/**
 * Standard page sizes in points (72 points = 1 inch).
 */
const PAGE_DIMENSIONS = {
  a4: { width: 595.28, height: 841.89 },
  letter: { width: 612.0, height: 792.0 },
};

/**
 * Helper to ensure image bytes are compatible with pdf-lib.
 * PNG pixels embed directly. JPEG/WebP render to PNG so browser-decoded orientation
 * is baked into the pixels and source JPEG metadata is not copied into the PDF.
 */
async function getCompatibleImageBytes(
  file: Blob,
  filename: string
): Promise<{ format: 'jpg' | 'png'; bytes: Uint8Array; width: number; height: number }> {
  const detected = await detectImageFormat(file);
  if (!detected || !['jpg', 'png', 'webp'].includes(detected)) throw new Error(`Unsupported image: ${filename}`);

  if (detected === 'png') {
    try {
      const arrayBuffer = await file.arrayBuffer();
      // Test decode dimensions to ensure validity
      const decoded = await decodeImage(file, filename);
      const { width, height } = decoded;
      decoded.close();
      return {
        format: detected,
        bytes: new Uint8Array(arrayBuffer),
        width,
        height,
      };
    } catch {
      // Fallback to canvas render
    }
  }

  // Render to canvas to produce standard PNG bytes
  const decoded = await decodeImage(file, filename);
  const { width, height } = decoded;

  const canvas = document.createElement('canvas');
  try {
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    decoded.close();
    throw new Error('Could not get canvas context for PDF image embedding.');
  }

  decoded.drawTo(ctx, 0, 0, width, height, 0, 0, width, height);
  decoded.close();

  const pngBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error('Failed to encode image to PNG for PDF embedding.'));
    }, 'image/png');
  });

  canvas.width = 0;
  canvas.height = 0;

  const arrayBuffer = await pngBlob.arrayBuffer();
  return {
    format: 'png',
    bytes: new Uint8Array(arrayBuffer),
    width,
    height,
  };
  } finally { decoded.close(); canvas.width = 0; canvas.height = 0; }
}

/**
 * Converts a list of image files into a single multi-page PDF or separate PDFs.
 * Uses dynamic import of pdf-lib to prevent bloating bundles on regular image pages.
 */
export async function convertImagesToPdf(
  files: File[],
  options: ImageToPdfOptions = {},
  outputPdfName = 'converted-document.pdf'
): Promise<ConvertedImageResult[]> {
  if (files.length === 0) return [];

  // Dynamically load pdf-lib only when PDF conversion is called
  const { PDFDocument } = await import('pdf-lib');

  const pageSize = options.pageSize || 'a4';
  const margin = options.margin ?? 20;
  if (!Number.isFinite(margin) || margin < 0 || margin > 200) throw new Error('PDF margins must be between 0 and 200 points.');
  const combine = options.combine ?? true;

  if (combine) {
    // Generate 1 combined multi-page PDF
    const pdfDoc = await PDFDocument.create();

    for (const file of files) {
      const { format, bytes, width: imgW, height: imgH } = await getCompatibleImageBytes(
        file,
        file.name
      );

      const embeddedImage =
        format === 'jpg' ? await pdfDoc.embedJpg(bytes) : await pdfDoc.embedPng(bytes);

      if (pageSize === 'fit') {
        // Page size exactly matches image dimensions
        const page = pdfDoc.addPage([imgW + margin * 2, imgH + margin * 2]);
        page.drawImage(embeddedImage, {
          x: margin,
          y: margin,
          width: imgW,
          height: imgH,
        });
      } else {
        // Standard A4 or Letter
        const standardDims = PAGE_DIMENSIONS[pageSize] || PAGE_DIMENSIONS.a4;
        let pageWidth = standardDims.width;
        let pageHeight = standardDims.height;

        // Auto-orient page to match image aspect ratio
        if (options.orientation === 'landscape' || (options.orientation === 'auto' && imgW > imgH)) {
          pageWidth = standardDims.height;
          pageHeight = standardDims.width;
        }

        const availW = pageWidth - margin * 2;
        const availH = pageHeight - margin * 2;
        const scale = Math.min(availW / imgW, availH / imgH, 1.0);
        const drawW = imgW * scale;
        const drawH = imgH * scale;

        const x = margin + (availW - drawW) / 2;
        const y = margin + (availH - drawH) / 2;

        const page = pdfDoc.addPage([pageWidth, pageHeight]);
        page.drawImage(embeddedImage, {
          x,
          y,
          width: drawW,
          height: drawH,
        });
      }
    }

    const pdfBytes = await pdfDoc.save();
    const pdfBlob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
    const blobUrl = URL.createObjectURL(pdfBlob);

    const safeBase = sanitizeFilename(outputPdfName.replace(/\.pdf$/i, '')) || 'document';
    const finalName = `${safeBase}.pdf`;

    return [
      {
        name: finalName,
        size: pdfBlob.size,
        blob: pdfBlob,
        blobUrl,
        mimeType: 'application/pdf',
        originalName: files.map((f) => f.name).join(', '),
        originalSize: files.reduce((acc, f) => acc + f.size, 0),
      },
    ];
  } else {
    // Generate separate PDF for each image
    const results: ConvertedImageResult[] = [];
    try {
    for (const file of files) {
      const pdfDoc = await PDFDocument.create();
      const { format, bytes, width: imgW, height: imgH } = await getCompatibleImageBytes(
        file,
        file.name
      );

      const embeddedImage =
        format === 'jpg' ? await pdfDoc.embedJpg(bytes) : await pdfDoc.embedPng(bytes);

      if (pageSize === 'fit') {
        const page = pdfDoc.addPage([imgW + margin * 2, imgH + margin * 2]);
        page.drawImage(embeddedImage, {
          x: margin,
          y: margin,
          width: imgW,
          height: imgH,
        });
      } else {
        const standardDims = PAGE_DIMENSIONS[pageSize] || PAGE_DIMENSIONS.a4;
        let pageWidth = standardDims.width;
        let pageHeight = standardDims.height;

        if (options.orientation === 'landscape' || (options.orientation === 'auto' && imgW > imgH)) {
          pageWidth = standardDims.height;
          pageHeight = standardDims.width;
        }

        const availW = pageWidth - margin * 2;
        const availH = pageHeight - margin * 2;
        const scale = Math.min(availW / imgW, availH / imgH, 1.0);
        const drawW = imgW * scale;
        const drawH = imgH * scale;

        const x = margin + (availW - drawW) / 2;
        const y = margin + (availH - drawH) / 2;

        const page = pdfDoc.addPage([pageWidth, pageHeight]);
        page.drawImage(embeddedImage, {
          x,
          y,
          width: drawW,
          height: drawH,
        });
      }

      const pdfBytes = await pdfDoc.save();
      const pdfBlob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
      const blobUrl = URL.createObjectURL(pdfBlob);

      const base = file.name.replace(/\.[a-zA-Z0-9]+$/i, '');
      const safeBase = sanitizeFilename(base) || 'document';

      results.push({
        name: `${safeBase}.pdf`,
        size: pdfBlob.size,
        blob: pdfBlob,
        blobUrl,
        mimeType: 'application/pdf',
        originalName: file.name,
        originalSize: file.size,
      });
    }

    return results;
    } catch (error) { results.forEach(result => URL.revokeObjectURL(result.blobUrl)); throw error; }
  }
}
