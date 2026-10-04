/**
 * File validation utilities.
 * Do not trust filename/MIME/extension alone. Validate bytes, batch count,
 * extension, MIME, magic bytes, and filename length/characters.
 */

const MAGIC_SIGNATURES: Record<string, Uint8Array> = {
  "image/jpeg": new Uint8Array([0xff, 0xd8, 0xff]),
  "image/png": new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  "image/gif": new Uint8Array([0x47, 0x49, 0x46]),
  "image/webp": new Uint8Array([0x52, 0x49, 0x46, 0x46]), // RIFF header
  "application/pdf": new Uint8Array([0x25, 0x50, 0x44, 0x46]), // %PDF
  "application/zip": new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
  "audio/wav": new Uint8Array([0x52, 0x49, 0x46, 0x46]),
  "audio/x-wav": new Uint8Array([0x52, 0x49, 0x46, 0x46]),
  "audio/flac": new Uint8Array([0x66, 0x4c, 0x61, 0x43]),
  "audio/x-flac": new Uint8Array([0x66, 0x4c, 0x61, 0x43]),
  "video/webm": new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]),
};

const EXTENSION_TO_MIME: Record<string, string[]> = {
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  png: ["image/png"],
  gif: ["image/gif"],
  webp: ["image/webp"],
  bmp: ["image/bmp"],
  tiff: ["image/tiff"],
  tif: ["image/tiff"],
  svg: ["image/svg+xml"],
  pdf: ["application/pdf"],
  doc: ["application/msword"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  pptx: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  csv: ["text/csv", "application/csv"],
  json: ["application/json"],
  xml: ["application/xml", "text/xml"],
  yaml: ["application/x-yaml", "text/yaml"],
  yml: ["application/x-yaml", "text/yaml"],
  txt: ["text/plain"],
  md: ["text/markdown"],
  html: ["text/html"],
  zip: ["application/zip"],
  mp3: ["audio/mpeg"],
  wav: ["audio/wav", "audio/x-wav"],
  flac: ["audio/flac", "audio/x-flac"],
  tar: ["application/x-tar"],
  mp4: ["video/mp4"],
  webm: ["video/webm"],
};

/**
 * Extract file extension from a filename (lowercase, no dot).
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split(".");
  if (parts.length < 2) return "";
  return parts.pop()!.toLowerCase();
}

/**
 * Check whether a file's extension is in an allowed list.
 */
export function isExtensionAllowed(
  filename: string,
  allowedExtensions: string[]
): boolean {
  const ext = getFileExtension(filename);
  return allowedExtensions.includes(ext);
}

/**
 * Check if MIME type is plausible for a given extension.
 */
export function isMimePlausible(filename: string, mimeType: string): boolean {
  const ext = getFileExtension(filename);
  const expected = EXTENSION_TO_MIME[ext];
  if (!expected) return true; // unknown extension, allow through
  return expected.includes(mimeType);
}

/** Expected header type when a browser does not supply a MIME type. */
export function getExpectedMime(filename: string): string {
  return EXTENSION_TO_MIME[getFileExtension(filename)]?.[0] || "";
}

/**
 * Validate magic bytes of a file against known signatures.
 * Returns true if the file header matches the expected format, or
 * if no known signature exists for the MIME type.
 */
export function validateMagicBytes(
  header: Uint8Array,
  expectedMime: string
): boolean {
  const signature = MAGIC_SIGNATURES[expectedMime];
  if (!signature) return true; // no known signature, pass through

  if (header.length < signature.length) return false;

  for (let i = 0; i < signature.length; i++) {
    if (header[i] !== signature[i]) return false;
  }
  if (expectedMime === "image/webp") {
    return header.length >= 12 && header[8] === 0x57 && header[9] === 0x45 &&
      header[10] === 0x42 && header[11] === 0x50;
  }
  if (expectedMime === "audio/wav" || expectedMime === "audio/x-wav") {
    return header.length >= 12 && header[8] === 0x57 && header[9] === 0x41 &&
      header[10] === 0x56 && header[11] === 0x45;
  }
  return true;
}

/**
 * Validate filename safety — reject path traversal and excessive length.
 */
export function isFilenameSafe(filename: string): boolean {
  if (!filename || filename.length > 255) return false;
  if (filename.includes("..")) return false;
  if (/[/\\]/.test(filename)) return false;
  if (/[\x00-\x1f]/.test(filename)) return false;
  return true;
}
