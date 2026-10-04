import { z } from "zod";

export const ToolCategorySchema = z.enum([
  "pdf",
  "to_pdf",
  "from_pdf",
  "image",
  "document_data",
  "ebook",
  "audio",
  "video",
  "archive",
  "ocr",
  "ai",
]);

export type ToolCategory = z.infer<typeof ToolCategorySchema>;

export const ProcessingModeSchema = z.enum(["client", "server", "hybrid", "tbd"]);
export type ProcessingMode = z.infer<typeof ProcessingModeSchema>;

export const ToolStatusSchema = z.enum(["planned", "beta", "live", "disabled"]);
export type ToolStatus = z.infer<typeof ToolStatusSchema>;

export const ToolLimitsSchema = z.object({
  maxFileBytes: z.number().default(50 * 1024 * 1024), // 50MB default
  maxBatchCount: z.number().default(10),
  allowedMimeTypes: z.array(z.string()).optional(),
  allowedExtensions: z.array(z.string()).optional(),
});

export type ToolLimits = z.infer<typeof ToolLimitsSchema>;

export const ToolRecordSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  category: ToolCategorySchema,
  status: ToolStatusSchema.default("planned"),
  indexable: z.boolean().default(false),
  processingMode: ProcessingModeSchema.default("tbd"),
  inputFormats: z.array(z.string()).optional(),
  outputFormats: z.array(z.string()).optional(),
  limits: ToolLimitsSchema.optional(),
  relatedTools: z.array(z.string()).optional(),
  privacyLabel: z.string().optional(),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  notes: z.string().optional(),
});

export type ToolRecord = z.infer<typeof ToolRecordSchema>;
