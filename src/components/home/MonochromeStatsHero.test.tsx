import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MonochromeStatsHero } from "./MonochromeStatsHero";
import { GlyphMatrixBackground } from "./GlyphMatrixBackground";
import { CategoryFlipCard } from "../tools/CategoryFlipCard";
import { CATEGORIES } from "@/config/categories";
import { ToolRecord } from "@/types/tool";

describe("MonochromeStatsHero", () => {
  it("renders the primary brand headline and supporting copy", () => {
    render(<MonochromeStatsHero />);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toBeDefined();
    expect(heading.textContent).toContain("Any file.");
    expect(heading.textContent).toContain("Right format.");

    const subcopy = screen.getByText(/Convert images, organize PDF pages, and transform supported documents/i);
    expect(subcopy).toBeDefined();
  });

  it("guides visitors to choose an operation before uploading files", () => {
    render(<MonochromeStatsHero />);
    const primaryCta = screen.getByRole("link", { name: /Choose an operation/i });
    expect(primaryCta).toBeDefined();
    expect(primaryCta.getAttribute("href")).toBe("#search");

    const secondaryCta = screen.getByRole("link", { name: /Browse categories/i });
    expect(secondaryCta).toBeDefined();
    expect(secondaryCta.getAttribute("href")).toBe("#categories");

    expect(screen.getByText(/Choose a tool first\. Its page will guide you through selecting files and converting them\./i)).toBeDefined();
  });

  it("renders integrated stats cards with real metrics", () => {
    render(<MonochromeStatsHero />);
    expect(screen.getByText("130+")).toBeDefined();
    expect(screen.getByText("Conversion Tools")).toBeDefined();
    expect(screen.getByText("100% Free")).toBeDefined();
    expect(screen.getByText("No Sign-Up")).toBeDefined();
    expect(screen.getByText("Zero Storage")).toBeDefined();
    expect(screen.getByText("Private by Design")).toBeDefined();
    expect(screen.getByText("Clear Labels")).toBeDefined();
    expect(screen.getByText("Processing Transparency")).toBeDefined();
  });

});

describe("GlyphMatrixBackground", () => {
  it("renders an accessible aria-hidden background container with canvas", () => {
    const { container } = render(<GlyphMatrixBackground />);
    const wrapper = container.querySelector('[aria-hidden="true"]');
    expect(wrapper).toBeDefined();
    expect(wrapper?.querySelector("canvas")).toBeDefined();
  });
});

describe("CategoryFlipCard", () => {
  const sampleTools: ToolRecord[] = [
    {
      id: "pdf_merge",
      slug: "merge-pdf",
      title: "Merge PDF Files",
      description: "Combine multiple PDF documents into a single organized file.",
      category: "pdf",
      status: "live",
      processingMode: "client",
      indexable: true,
    },
    {
      id: "pdf_split",
      slug: "split-pdf",
      title: "Split PDF Pages",
      description: "Separate pages from a PDF document into individual files.",
      category: "pdf",
      status: "live",
      processingMode: "client",
      indexable: true,
    },
  ];

  it("renders category front side information and count", () => {
    render(<CategoryFlipCard category={CATEGORIES.pdf} tools={sampleTools} />);
    expect(screen.getByText("PDF Tools")).toBeDefined();
    expect(screen.getByText("2 tools")).toBeDefined();
  });

  it("supports flipping on button click and displays reverse side with formats", () => {
    render(<CategoryFlipCard category={CATEGORIES.pdf} tools={sampleTools} />);
    const flipBtn = screen.getByLabelText(/View supported formats for PDF Tools/i);
    fireEvent.click(flipBtn);

    expect(screen.getByText("Formats & Highlights")).toBeDefined();
    expect(screen.getByText(".pdf")).toBeDefined();
    expect(screen.getByText(".pdfa")).toBeDefined();
    expect(screen.getByText("Merge")).toBeDefined();
  });

  it("links to real live tools on the reverse side", () => {
    render(<CategoryFlipCard category={CATEGORIES.pdf} tools={sampleTools} />);
    const flipBtn = screen.getByLabelText(/View supported formats for PDF Tools/i);
    fireEvent.click(flipBtn);

    const liveLink = screen.getByRole("link", { name: /→ Merge PDF Files/i });
    expect(liveLink).toBeDefined();
    expect(liveLink.getAttribute("href")).toBe("/merge-pdf");
  });
});

