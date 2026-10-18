import { describe, it, expect } from "vitest";
import { TOOLS_REGISTRY, TOOLS_BY_SLUG, TOOLS_BY_ID } from "./tools";
import {
  getAllTools,
  getToolBySlug,
  getToolById,
  getToolsByCategory,
  getLiveTools,
  getRelatedTools,
  searchTools,
} from "@/lib/registry";

describe("Tool Registry", () => {
  it("loads tools from starter registry", () => {
    // Starter has 135 planned records; deduplication removes duplicates
    expect(TOOLS_REGISTRY.length).toBeGreaterThan(90);
    expect(getAllTools().length).toBe(TOOLS_REGISTRY.length);
  });

  it("ensures all tools have unique slugs", () => {
    const slugs = new Set<string>();
    for (const tool of TOOLS_REGISTRY) {
      expect(slugs.has(tool.slug), `Duplicate slug: ${tool.slug}`).toBe(false);
      slugs.add(tool.slug);
    }
  });

  it("ensures all tools have unique ids", () => {
    const ids = new Set<string>();
    for (const tool of TOOLS_REGISTRY) {
      expect(ids.has(tool.id), `Duplicate id: ${tool.id}`).toBe(false);
      ids.add(tool.id);
    }
  });

  it("finds a tool by slug using helper and map", () => {
    const mergeTool = getToolBySlug("merge-pdf");
    expect(mergeTool).toBeDefined();
    expect(mergeTool?.id).toBe("merge_pdf");
    expect(mergeTool?.category).toBe("pdf");
    expect(TOOLS_BY_SLUG.get("merge-pdf")).toEqual(mergeTool);
  });

  it("finds a tool by id using helper and map", () => {
    const mergeTool = getToolById("merge_pdf");
    expect(mergeTool).toBeDefined();
    expect(mergeTool?.slug).toBe("merge-pdf");
    expect(TOOLS_BY_ID.get("merge_pdf")).toEqual(mergeTool);
  });

  it("filters tools by category", () => {
    const pdfTools = getToolsByCategory("pdf");
    expect(pdfTools.length).toBeGreaterThan(0);
    expect(pdfTools.every((t) => t.category === "pdf")).toBe(true);
  });

  it("returns live tools including png-to-jpg and Phase 3 image family", () => {
    const liveTools = getLiveTools();
    expect(Array.isArray(liveTools)).toBe(true);
    expect(liveTools.every((t) => t.status === "live")).toBe(true);

    const phase3LiveSlugs = [
      "png-to-jpg",
      "jpg-to-png",
      "jpg-to-webp",
      "png-to-webp",
      "webp-to-jpg",
      "webp-to-png",
      "image-resize",
      "image-compress",
      "image-crop",
      "image-to-pdf",
    ];

    for (const slug of phase3LiveSlugs) {
      const tool = getToolBySlug(slug);
      expect(tool).toBeDefined();
      expect(tool?.status).toBe("live");
      expect(tool?.processingMode).toBe("client");
    }

    const heicToJpg = getToolBySlug("heic-to-jpg");
    expect(heicToJpg).toBeDefined();
    expect(heicToJpg?.status).toBe("planned");
  });

  it("returns related tools fallback within same category", () => {
    const mergeTool = getToolBySlug("merge-pdf");
    expect(mergeTool).toBeDefined();
    if (mergeTool) {
      const related = getRelatedTools(mergeTool, 3);
      expect(related.length).toBeLessThanOrEqual(3);
      expect(related.every((t) => t.id !== mergeTool.id)).toBe(true);
    }
  });

  it("searches tools by keyword query", () => {
    const results = searchTools("jpg");
    expect(results.length).toBeGreaterThan(0);
    expect(
      results.some(
        (t) =>
          t.slug.includes("jpg") ||
          t.id.includes("jpg") ||
          t.title?.toLowerCase().includes("jpg")
      )
    ).toBe(true);
  });

  it("returns all tools when search query is empty", () => {
    const results = searchTools("");
    expect(results.length).toBe(TOOLS_REGISTRY.length);
  });

  it("keeps documented AI entries planned and non-indexable until provider gates pass", () => {
    const aiSlugs = ["ai-document-summarizer", "translate-document", "pdf-to-structured-markdown"];
    for (const slug of aiSlugs) {
      const tool = getToolBySlug(slug);
      expect(tool, slug).toBeDefined();
      expect(tool?.status).toBe("planned");
      expect(tool?.indexable).toBe(false);
      expect(tool?.processingMode).toBe("hybrid");
      expect(tool?.privacyLabel).toBe("AI processing disabled in this release");
    }
  });

  it("advertises only the two approved server converters as live", () => {
    const liveServerTools = TOOLS_REGISTRY
      .filter((tool) => tool.processingMode === "server" && tool.status === "live")
      .map((tool) => tool.slug)
      .sort();
    expect(liveServerTools).toEqual(["tar-to-zip", "zip-to-tar"]);

    for (const slug of ["image-to-text", "pdf-to-text", "ocr-pdf"]) {
      expect(getToolBySlug(slug)?.status).toBe("planned");
      expect(getToolBySlug(slug)?.indexable).toBe(false);
    }
  });
});
