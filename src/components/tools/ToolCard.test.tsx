import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { ToolCard } from "./ToolCard";
import { ToolRecord } from "@/types/tool";

describe("ToolCard Component", () => {
  const mockTool: ToolRecord = {
    id: "merge_pdf",
    slug: "merge-pdf",
    title: "Merge PDF",
    description: "Combine multiple PDF files into one single document.",
    category: "pdf",
    status: "planned",
    indexable: true,
    processingMode: "client",
  };

  it("renders tool title and description correctly", () => {
    render(<ToolCard tool={mockTool} />);
    expect(screen.getByText("Merge PDF")).toBeDefined();
    expect(
      screen.getByText("Combine multiple PDF files into one single document.")
    ).toBeDefined();
  });

  it("displays Coming Soon badge for planned tools", () => {
    render(<ToolCard tool={mockTool} />);
    expect(screen.getByText("Coming Soon")).toBeDefined();
  });

  it("displays PrivacyBadge for live tools", () => {
    const liveTool: ToolRecord = {
      ...mockTool,
      status: "live",
      processingMode: "client",
    };
    render(<ToolCard tool={liveTool} />);
    expect(screen.getByText("Runs in browser")).toBeDefined();
  });

  it("renders accessible link with aria-label", () => {
    render(<ToolCard tool={mockTool} />);
    const link = screen.getByRole("article").querySelector("a");
    expect(link).toBeDefined();
    expect(link?.getAttribute("aria-label")).toContain("Merge PDF");
  });
});
