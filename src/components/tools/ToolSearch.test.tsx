import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ToolSearch } from "./ToolSearch";
import { ToolRecord } from "@/types/tool";

describe("ToolSearch Component", () => {
  const mockTools: ToolRecord[] = [
    {
      id: "png_to_jpg",
      slug: "png-to-jpg",
      title: "PNG to JPG",
      description: "Convert transparent PNG images to clean JPG format.",
      category: "image",
      status: "planned",
      indexable: true,
      processingMode: "client",
    },
    {
      id: "merge_pdf",
      slug: "merge-pdf",
      title: "Merge PDF",
      description: "Combine multiple PDF documents together.",
      category: "pdf",
      status: "planned",
      indexable: true,
      processingMode: "client",
    },
    {
      id: "mp3_to_wav",
      slug: "mp3-to-wav",
      title: "MP3 to WAV",
      description: "Convert MP3 audio to uncompressed WAV audio.",
      category: "audio",
      status: "planned",
      indexable: true,
      processingMode: "client",
    },
  ];

  it("renders search input and initial tools", () => {
    render(<ToolSearch initialTools={mockTools} />);
    expect(screen.getByPlaceholderText(/Search all 130\+ tools/i)).toBeDefined();
    expect(screen.getByText("PNG to JPG")).toBeDefined();
    expect(screen.getByText("Merge PDF")).toBeDefined();
    expect(screen.getByText("MP3 to WAV")).toBeDefined();
  });

  it("filters tools based on text search query", () => {
    render(<ToolSearch initialTools={mockTools} />);
    const input = screen.getByPlaceholderText(/Search all 130\+ tools/i);
    fireEvent.change(input, { target: { value: "jpg" } });

    expect(screen.getByText("PNG to JPG")).toBeDefined();
    expect(screen.queryByText("Merge PDF")).toBeNull();
  });

  it("shows empty state when no tools match query", () => {
    render(<ToolSearch initialTools={mockTools} />);
    const input = screen.getByPlaceholderText(/Search all 130\+ tools/i);
    fireEvent.change(input, { target: { value: "nonexistentformatxyz" } });

    expect(screen.getByText("No tools found")).toBeDefined();
  });
});
