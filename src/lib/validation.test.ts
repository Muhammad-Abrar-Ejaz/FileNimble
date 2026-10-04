import { describe, it, expect } from "vitest";
import {
  getFileExtension,
  isExtensionAllowed,
  isMimePlausible,
  validateMagicBytes,
  isFilenameSafe,
} from "./validation";

describe("File Validation", () => {
  it("rejects spoofed Phase 11 media headers and accepts the documented signatures", () => {
    const wave = new TextEncoder().encode("RIFFxxxxWAVE");
    expect(validateMagicBytes(wave, "audio/wav")).toBe(true);
    expect(validateMagicBytes(new TextEncoder().encode("RIFFxxxxWEBP"), "audio/wav")).toBe(false);
    expect(validateMagicBytes(new TextEncoder().encode("fLaC"), "audio/flac")).toBe(true);
    expect(validateMagicBytes(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]), "video/webm")).toBe(true);
    for (const mime of ["audio/wav", "audio/flac", "video/webm"]) {
      expect(validateMagicBytes(new TextEncoder().encode("not media"), mime)).toBe(false);
    }
    expect(isMimePlausible("sound.flac", "application/pdf")).toBe(false);
    expect(isMimePlausible("sound.wav", "audio/x-wav")).toBe(true);
  });
  describe("getFileExtension", () => {
    it("extracts extension from filename", () => {
      expect(getFileExtension("photo.jpg")).toBe("jpg");
      expect(getFileExtension("document.PDF")).toBe("pdf");
      expect(getFileExtension("archive.tar.gz")).toBe("gz");
    });

    it("returns empty for files without extension", () => {
      expect(getFileExtension("Makefile")).toBe("");
    });
  });

  describe("isExtensionAllowed", () => {
    it("accepts allowed extensions", () => {
      expect(isExtensionAllowed("photo.png", ["png", "jpg"])).toBe(true);
    });

    it("rejects disallowed extensions", () => {
      expect(isExtensionAllowed("script.exe", ["png", "jpg"])).toBe(false);
    });
  });

  describe("isMimePlausible", () => {
    it("accepts matching mime/extension pairs", () => {
      expect(isMimePlausible("photo.jpg", "image/jpeg")).toBe(true);
      expect(isMimePlausible("doc.pdf", "application/pdf")).toBe(true);
    });

    it("rejects mismatched mime/extension", () => {
      expect(isMimePlausible("photo.jpg", "application/pdf")).toBe(false);
    });

    it("allows unknown extensions through", () => {
      expect(isMimePlausible("file.xyz", "application/octet-stream")).toBe(true);
    });
  });

  describe("validateMagicBytes", () => {
    it("validates PNG magic bytes", () => {
      const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      expect(validateMagicBytes(pngHeader, "image/png")).toBe(true);
    });

    it("validates JPEG magic bytes", () => {
      const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
      expect(validateMagicBytes(jpegHeader, "image/jpeg")).toBe(true);
    });

    it("rejects truncated PNG headers and RIFF files that are not WebP", () => {
      expect(validateMagicBytes(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), "image/png")).toBe(false);
      const riff = new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 65, 86, 69]);
      expect(validateMagicBytes(riff, "image/webp")).toBe(false);
      riff.set([87, 69, 66, 80], 8);
      expect(validateMagicBytes(riff, "image/webp")).toBe(true);
    });

    it("rejects wrong magic bytes", () => {
      const wrongHeader = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
      expect(validateMagicBytes(wrongHeader, "image/png")).toBe(false);
    });

    it("passes unknown MIME types", () => {
      const any = new Uint8Array([0x00]);
      expect(validateMagicBytes(any, "application/unknown")).toBe(true);
    });
  });

  describe("isFilenameSafe", () => {
    it("accepts normal filenames", () => {
      expect(isFilenameSafe("photo.jpg")).toBe(true);
      expect(isFilenameSafe("my-document_v2.pdf")).toBe(true);
    });

    it("rejects path traversal", () => {
      expect(isFilenameSafe("../etc/passwd")).toBe(false);
      expect(isFilenameSafe("..\\windows\\system32")).toBe(false);
    });

    it("rejects slashes", () => {
      expect(isFilenameSafe("path/to/file.txt")).toBe(false);
      expect(isFilenameSafe("path\\to\\file.txt")).toBe(false);
    });

    it("rejects empty and overly long filenames", () => {
      expect(isFilenameSafe("")).toBe(false);
      expect(isFilenameSafe("a".repeat(256))).toBe(false);
    });

    it("rejects control characters", () => {
      expect(isFilenameSafe("file\x00.txt")).toBe(false);
    });
  });
});
