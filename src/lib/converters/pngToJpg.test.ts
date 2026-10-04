import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isPngFile,
  getOutputJpgFilename,
  convertPngToJpg,
  convertPngBatch,
  createBatchZip,
  revokeConvertedUrls,
  ConvertedImageResult,
} from "./pngToJpg";

// Minimal valid 1x1 PNG byte sequence
const VALID_PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
  0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
  0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
]);

describe("PNG to JPG Conversion Engine", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("isPngFile", () => {
    it("identifies valid PNG files by magic header", async () => {
      const file = new File([VALID_PNG_BYTES], "photo.png", {
        type: "image/png",
      });
      const valid = await isPngFile(file);
      expect(valid).toBe(true);
    });

    it("rejects files with invalid magic bytes", async () => {
      const corrupt = new File([new Uint8Array([0x00, 0x01, 0x02, 0x03])], "fake.png", {
        type: "image/png",
      });
      const valid = await isPngFile(corrupt);
      expect(valid).toBe(false);
    });

    it("rejects non-PNG files (e.g. text/plain)", async () => {
      const textFile = new File(["not an image"], "note.txt", {
        type: "text/plain",
      });
      const valid = await isPngFile(textFile);
      expect(valid).toBe(false);
    });
  });

  describe("getOutputJpgFilename", () => {
    it("replaces .png extension with .jpg", () => {
      expect(getOutputJpgFilename("diagram.png")).toBe("diagram.jpg");
      expect(getOutputJpgFilename("PHOTO.PNG")).toBe("PHOTO.jpg");
    });

    it("sanitizes dangerous characters in filename", () => {
      expect(getOutputJpgFilename("../unsafe/photo.png")).toBe("photo.jpg");
      expect(getOutputJpgFilename("file;name with [symbols].png")).toBe(
        "file_name_with__symbols_.jpg"
      );
    });

    it("falls back to converted.jpg if base is empty", () => {
      expect(getOutputJpgFilename(".png")).toBe("converted.jpg");
    });
  });

  describe("convertPngToJpg", () => {
    it("rejects invalid PNG before canvas decoding", async () => {
      const invalid = new File(["not a real png header"], "corrupt.png", {
        type: "image/png",
      });
      await expect(convertPngToJpg(invalid)).rejects.toThrow(
        /not a valid PNG image/i
      );
    });

    it("converts a valid PNG and flattens transparency with background color", async () => {
      const validFile = new File([VALID_PNG_BYTES], "graphic.png", {
        type: "image/png",
      });

      // Mock canvas environment in happy-dom
      const mockBlob = new Blob([new Uint8Array([255, 216, 255])], { type: "image/jpeg" });
      const fillRectSpy = vi.fn();
      const drawImageSpy = vi.fn();

      vi.spyOn(document, "createElement").mockImplementation((tag) => {
        if (tag === "canvas") {
          return {
            width: 1,
            height: 1,
            getContext: () => ({
              fillStyle: "",
              fillRect: fillRectSpy,
              drawImage: drawImageSpy,
            }),
            toBlob: (cb: (b: Blob) => void) => cb(mockBlob),
          } as unknown as HTMLCanvasElement;
        }
        return document.createElement(tag);
      });

      // Mock createImageBitmap
      window.createImageBitmap = vi.fn().mockResolvedValue({
        width: 100,
        height: 100,
        close: vi.fn(),
      } as unknown as ImageBitmap);

      const result = await convertPngToJpg(validFile, {
        quality: 0.9,
        backgroundColor: "#000000",
      });

      expect(result.name).toBe("graphic.jpg");
      expect(result.mimeType).toBe("image/jpeg");
      expect(result.originalName).toBe("graphic.png");
      expect(fillRectSpy).toHaveBeenCalledWith(0, 0, 100, 100);
      expect(drawImageSpy).toHaveBeenCalled();
    });
  });

  describe("convertPngBatch", () => {
    it("converts a batch of PNG files and reports progress", async () => {
      const validFile1 = new File([VALID_PNG_BYTES], "image1.png", {
        type: "image/png",
      });
      const validFile2 = new File([VALID_PNG_BYTES], "image2.png", {
        type: "image/png",
      });

      const mockBlob = new Blob([new Uint8Array([255, 216, 255])], { type: "image/jpeg" });
      vi.spyOn(document, "createElement").mockImplementation((tag) => {
        if (tag === "canvas") {
          return {
            width: 1,
            height: 1,
            getContext: () => ({
              fillStyle: "",
              fillRect: vi.fn(),
              drawImage: vi.fn(),
            }),
            toBlob: (cb: (b: Blob) => void) => cb(mockBlob),
          } as unknown as HTMLCanvasElement;
        }
        return document.createElement(tag);
      });

      window.createImageBitmap = vi.fn().mockResolvedValue({
        width: 50,
        height: 50,
        close: vi.fn(),
      } as unknown as ImageBitmap);

      const progressSpy = vi.fn();
      const batchResult = await convertPngBatch(
        [validFile1, validFile2],
        { quality: 0.85, backgroundColor: "#FFFFFF" },
        progressSpy
      );

      expect(batchResult.successful.length).toBe(2);
      expect(batchResult.failed.length).toBe(0);
      expect(progressSpy).toHaveBeenCalled();
    });

    it("handles partial failure without destroying the batch", async () => {
      const validFile = new File([VALID_PNG_BYTES], "good.png", {
        type: "image/png",
      });
      const badFile = new File(["bad data"], "corrupt.png", {
        type: "image/png",
      });

      const mockBlob = new Blob([new Uint8Array([255, 216, 255])], { type: "image/jpeg" });
      vi.spyOn(document, "createElement").mockImplementation((tag) => {
        if (tag === "canvas") {
          return {
            width: 1,
            height: 1,
            getContext: () => ({
              fillStyle: "",
              fillRect: vi.fn(),
              drawImage: vi.fn(),
            }),
            toBlob: (cb: (b: Blob) => void) => cb(mockBlob),
          } as unknown as HTMLCanvasElement;
        }
        return document.createElement(tag);
      });

      window.createImageBitmap = vi.fn().mockResolvedValue({
        width: 50,
        height: 50,
        close: vi.fn(),
      } as unknown as ImageBitmap);

      const batchResult = await convertPngBatch([validFile, badFile]);

      expect(batchResult.successful.length).toBe(1);
      expect(batchResult.successful[0].name).toBe("good.jpg");
      expect(batchResult.failed.length).toBe(1);
      expect(batchResult.failed[0].file.name).toBe("corrupt.png");
    });
  });

  describe("createBatchZip & revokeConvertedUrls", () => {
    it("packages multiple results into a downloadable ZIP archive", async () => {
      const dummyBlob = new Blob(["test"], { type: "image/jpeg" });
      const results: ConvertedImageResult[] = [
        {
          name: "photo.jpg",
          size: 4,
          blob: dummyBlob,
          blobUrl: "blob:http://localhost/1",
          mimeType: "image/jpeg",
          originalName: "photo.png",
          originalSize: 10,
        },
        {
          name: "banner.jpg",
          size: 4,
          blob: dummyBlob,
          blobUrl: "blob:http://localhost/2",
          mimeType: "image/jpeg",
          originalName: "banner.png",
          originalSize: 15,
        },
      ];

      const zipData = await createBatchZip(results, "my-images.zip");
      expect(zipData.filename).toBe("my-images.zip");
      expect(zipData.blob).toBeDefined();
      expect(zipData.blob.size).toBeGreaterThan(0);
    });

    it("revokes object URLs cleanly to release memory", () => {
      const revokeSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
      const results: ConvertedImageResult[] = [
        {
          name: "test.jpg",
          size: 10,
          blob: new Blob([]),
          blobUrl: "blob:http://localhost/test",
          mimeType: "image/jpeg",
          originalName: "test.png",
          originalSize: 20,
        },
      ];

      revokeConvertedUrls(results);
      expect(revokeSpy).toHaveBeenCalledWith("blob:http://localhost/test");
    });
  });
});
