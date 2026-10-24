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

  it("renders dual accessible CTAs leading to real sections", () => {
    render(<MonochromeStatsHero />);
    const primaryCta = screen.getByRole("link", { name: /Select or Drop Files/i });
    expect(primaryCta).toBeDefined();
    expect(primaryCta.getAttribute("href")).toBe("#uploader");

    const secondaryCta = screen.getByRole("link", { name: /Explore All Tools/i });
    expect(secondaryCta).toBeDefined();
    expect(secondaryCta.getAttribute("href")).toBe("#search");
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

  it("renders child uploader slot within #uploader container", () => {
    render(
      <MonochromeStatsHero>
        <div data-testid="test-uploader">Dropzone Child</div>
      </MonochromeStatsHero>
    );
    expect(screen.getByTestId("test-uploader")).toBeDefined();
    expect(document.getElementById("uploader")).toBeDefined();
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

  it("manages keyboard focusability and inert attributes across flip states", () => {
    const { container } = render(
      <CategoryFlipCard category={CATEGORIES.pdf} tools={sampleTools} />
    );

    const region = screen.getByRole("region");
    expect(region.getAttribute("aria-label")).toContain("Press Enter to flip for supported formats");

    // Front face should be active and accessible to screen readers
    const flipBtn = screen.getByRole("button", { name: /View supported formats for PDF Tools/i });
    expect(flipBtn.getAttribute("tabindex")).toBe("0");

    // Back face controls are hidden from screen readers without { hidden: true }
    expect(screen.queryByRole("button", { name: /Flip back to front/i })).toBeNull();
    const backFlipBtn = screen.getByRole("button", { name: /Flip back to front/i, hidden: true });
    expect(backFlipBtn.getAttribute("tabindex")).toBe("-1");

    expect(screen.queryByRole("link", { name: /→ Merge PDF Files/i })).toBeNull();
    const liveLink = screen.getByRole("link", { name: /→ Merge PDF Files/i, hidden: true });
    expect(liveLink.getAttribute("tabindex")).toBe("-1");

    const viewAllBtn = screen.getByRole("link", { name: /View all 2 tools/i, hidden: true });
    expect(viewAllBtn.getAttribute("tabindex")).toBe("-1");

    const frontFace = container.querySelector(".backface-hidden:not(.rotate-y-180)");
    const backFace = container.querySelector(".backface-hidden.rotate-y-180");
    expect(frontFace?.hasAttribute("inert")).toBe(false);
    expect(frontFace?.getAttribute("aria-hidden")).toBe("false");
    expect(backFace?.hasAttribute("inert")).toBe(true);
    expect(backFace?.getAttribute("aria-hidden")).toBe("true");

    // Flip to back
    fireEvent.click(flipBtn);

    expect(region.getAttribute("aria-label")).toContain("Press Enter to flip back");

    // Now front face is hidden, back face is active and accessible
    expect(screen.queryByRole("button", { name: /View supported formats for PDF Tools/i })).toBeNull();
    expect(flipBtn.getAttribute("tabindex")).toBe("-1");

    const activeBackFlipBtn = screen.getByRole("button", { name: /Flip back to front/i });
    expect(activeBackFlipBtn.getAttribute("tabindex")).toBe("0");

    const activeLiveLink = screen.getByRole("link", { name: /→ Merge PDF Files/i });
    expect(activeLiveLink.getAttribute("tabindex")).toBe("0");

    const activeViewAllBtn = screen.getByRole("link", { name: /View all 2 tools/i });
    expect(activeViewAllBtn.getAttribute("tabindex")).toBe("0");

    expect(frontFace?.hasAttribute("inert")).toBe(true);
    expect(frontFace?.getAttribute("aria-hidden")).toBe("true");
    expect(backFace?.hasAttribute("inert")).toBe(false);
    expect(backFace?.getAttribute("aria-hidden")).toBe("false");

    // Flip back via back button
    fireEvent.click(activeBackFlipBtn);

    expect(region.getAttribute("aria-label")).toContain("Press Enter to flip for supported formats");
    expect(flipBtn.getAttribute("tabindex")).toBe("0");
    expect(backFlipBtn.getAttribute("tabindex")).toBe("-1");
    expect(liveLink.getAttribute("tabindex")).toBe("-1");
    expect(viewAllBtn.getAttribute("tabindex")).toBe("-1");
    expect(frontFace?.hasAttribute("inert")).toBe(false);
    expect(frontFace?.getAttribute("aria-hidden")).toBe("false");
    expect(backFace?.hasAttribute("inert")).toBe(true);
    expect(backFace?.getAttribute("aria-hidden")).toBe("true");
  });

  it("supports flipping via Enter and Space keyboard events on the card region", () => {
    render(<CategoryFlipCard category={CATEGORIES.pdf} tools={sampleTools} />);
    const region = screen.getByRole("region");

    expect(region.getAttribute("aria-label")).toContain("Press Enter to flip for supported formats");

    // Press Enter on region
    fireEvent.keyDown(region, { key: "Enter" });
    expect(region.getAttribute("aria-label")).toContain("Press Enter to flip back");

    // Press Space on region
    fireEvent.keyDown(region, { key: " " });
    expect(region.getAttribute("aria-label")).toContain("Press Enter to flip for supported formats");
  });
});
