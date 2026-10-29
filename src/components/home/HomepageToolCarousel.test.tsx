import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HomepageToolCarousel } from "./HomepageToolCarousel";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const tools = [
  { slug: "merge-pdf", title: "Merge PDF Files", processingMode: "client" as const },
  { slug: "png-to-jpg", title: "PNG to JPG", processingMode: "client" as const },
  { slug: "tar-to-zip", title: "Convert TAR to ZIP", processingMode: "server" as const },
  { slug: "zip-to-tar", title: "Convert ZIP to TAR", processingMode: "server" as const },
  { slug: "organize-pdf", title: "Reorder PDF Pages", processingMode: "client" as const },
];

describe("HomepageToolCarousel", () => {
  beforeEach(() => push.mockClear());

  it("shows only the supplied available tools with crawlable links and local artwork", () => {
    const { container } = render(<HomepageToolCarousel tools={tools} />);

    expect(screen.getByRole("region", { name: "Available FileNimble conversion tools" })).toBeDefined();
    for (const tool of tools) {
      expect(screen.getByRole("link", { name: tool.title })).toHaveProperty("href", expect.stringContaining(`/${tool.slug}`));
    }

    const images = container.querySelectorAll(".circular-carousel__photo");
    expect(images.length).toBeGreaterThan(0);
    for (const image of images) {
      expect((image as HTMLImageElement).src).toContain("data:image/svg+xml");
      expect((image as HTMLImageElement).src).not.toContain("unsplash");
    }
  });

  it("opens the clicked carousel item", () => {
    const { container } = render(<HomepageToolCarousel tools={tools} />);
    const firstSlide = container.querySelector('[data-cc-index="0"]');

    expect(firstSlide).not.toBeNull();
    fireEvent.click(firstSlide!);
    expect(push).toHaveBeenCalledWith("/merge-pdf");
  });
});
