import { ToolCategory } from "@/types/tool";

export interface CategoryMeta {
  id: ToolCategory;
  name: string;
  description: string;
  accentColor: string;
  bgLight: string;
  badgeClass: string;
}

export const CATEGORIES: Record<ToolCategory, CategoryMeta> = {
  pdf: {
    id: "pdf",
    name: "PDF Tools",
    description: "Merge, split, compress, rotate, protect, and manipulate PDF documents.",
    accentColor: "#EF4444",
    bgLight: "#FEF2F2",
    badgeClass: "text-red-700 bg-red-50 border-red-200",
  },
  to_pdf: {
    id: "to_pdf",
    name: "Convert to PDF",
    description: "Convert images, Office files, and documents into standard PDF format.",
    accentColor: "#DC2626",
    bgLight: "#FEF2F2",
    badgeClass: "text-red-800 bg-red-50 border-red-200",
  },
  from_pdf: {
    id: "from_pdf",
    name: "Convert from PDF",
    description: "Extract images, text, Word documents, and spreadsheets from PDF files.",
    accentColor: "#B91C1C",
    bgLight: "#FEF2F2",
    badgeClass: "text-red-900 bg-red-50 border-red-200",
  },
  image: {
    id: "image",
    name: "Image Tools",
    description: "Convert, resize, crop, and optimize JPG, PNG, WebP, SVG, and other image formats.",
    accentColor: "#D97706",
    bgLight: "#FFFBEB",
    badgeClass: "text-amber-700 bg-amber-50 border-amber-200",
  },
  document_data: {
    id: "document_data",
    name: "Documents & Data",
    description: "Transform Word, PowerPoint, Excel, Markdown, CSV, JSON, XML, and YAML files.",
    accentColor: "#2563EB",
    bgLight: "#EFF6FF",
    badgeClass: "text-blue-700 bg-blue-50 border-blue-200",
  },
  ebook: {
    id: "ebook",
    name: "eBook Converters",
    description: "Convert EPUB, MOBI, and digital publication documents safely.",
    accentColor: "#4F46E5",
    bgLight: "#EEF2FF",
    badgeClass: "text-indigo-700 bg-indigo-50 border-indigo-200",
  },
  audio: {
    id: "audio",
    name: "Audio Tools",
    description: "Convert MP3, WAV, M4A, OGG, and extract audio tracks from video files.",
    accentColor: "#7C3AED",
    bgLight: "#F5F3FF",
    badgeClass: "text-violet-700 bg-violet-50 border-violet-200",
  },
  video: {
    id: "video",
    name: "Video Tools",
    description: "Transcode, compress, trim, and convert MP4, WebM, and GIF files.",
    accentColor: "#9333EA",
    bgLight: "#FAF5FF",
    badgeClass: "text-purple-700 bg-purple-50 border-purple-200",
  },
  archive: {
    id: "archive",
    name: "Archive Utilities",
    description: "Pack and extract ZIP, 7Z, TAR, and GZ archives with decompression safeguards.",
    accentColor: "#4B5563",
    bgLight: "#F9FAFB",
    badgeClass: "text-gray-700 bg-gray-50 border-gray-200",
  },
  ocr: {
    id: "ocr",
    name: "OCR & Scans",
    description: "Extract editable text from scanned documents and images.",
    accentColor: "#059669",
    bgLight: "#ECFDF5",
    badgeClass: "text-emerald-700 bg-emerald-50 border-emerald-200",
  },
  ai: {
    id: "ai",
    name: "AI Document Tools",
    description: "Summarize, translate, and extract structured information from documents.",
    accentColor: "#6366F1",
    bgLight: "#EEF2FF",
    badgeClass: "text-indigo-700 bg-indigo-50 border-indigo-200",
  },
};
