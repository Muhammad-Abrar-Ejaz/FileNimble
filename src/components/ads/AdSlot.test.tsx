import React from "react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdSlot } from "./AdSlot";
import { ToolRecord } from "@/types/tool";

describe("AdSlot Component", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;
    delete process.env.NEXT_PUBLIC_ADSENSE_ENABLED;
    delete process.env.NEXT_PUBLIC_ADSENSE_TEST_MODE;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("renders null by default when ads are disabled (clean disabled state)", () => {
    const { container } = render(<AdSlot placement="tool-after-converter" />);
    expect(container.firstChild).toBeNull();
  });

  it("suppresses ads on planned tools even if ads are enabled", () => {
    process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID = "ca-pub-1234567890123456";
    process.env.NEXT_PUBLIC_ADSENSE_ENABLED = "true";

    const plannedTool: ToolRecord = {
      id: "pdf_to_docx",
      slug: "pdf-to-docx",
      category: "document_data",
      status: "planned",
      indexable: false,
      processingMode: "server",
    };

    const { container } = render(
      <AdSlot placement="tool-after-converter" tool={plannedTool} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders accessible preview box in test mode", () => {
    process.env.NEXT_PUBLIC_ADSENSE_TEST_MODE = "true";

    render(<AdSlot placement="home-after-hero" format="horizontal" />);

    const region = screen.getByRole("region", { name: /Advertisement Preview/i });
    expect(region).toBeDefined();
    expect(region.textContent).toContain("Advertisement (Preview / Test Mode)");
    expect(region.textContent).toContain("home-after-hero");
    expect(region.textContent).toContain("horizontal");
  });

  it("renders production AdSense markup when enabled with valid credentials", () => {
    process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID = "ca-pub-1234567890123456";
    process.env.NEXT_PUBLIC_ADSENSE_ENABLED = "true";
    process.env.NEXT_PUBLIC_CMP_ENABLED = "true";
    process.env.NEXT_PUBLIC_CMP_SCRIPT_URL = "https://cmp.example.test/tcf.js";

    const liveTool: ToolRecord = {
      id: "jpg_to_png",
      slug: "jpg-to-png",
      category: "image",
      status: "live",
      indexable: true,
      processingMode: "client",
    };

    const { container } = render(
      <AdSlot placement="tool-after-converter" tool={liveTool} slotId="1122334455" />
    );

    const region = screen.getByRole("region", { name: "Advertisement" });
    expect(region).toBeDefined();
    expect(region.textContent).toContain("Advertisement");

    const ins = container.querySelector("ins.adsbygoogle");
    expect(ins).toBeDefined();
    expect(ins?.getAttribute("data-ad-client")).toBe("ca-pub-1234567890123456");
    expect(ins?.getAttribute("data-ad-slot")).toBe("1122334455");
  });

  it("never contains button elements or deceptive CTA labels", () => {
    process.env.NEXT_PUBLIC_ADSENSE_TEST_MODE = "true";

    const { container } = render(<AdSlot placement="tool-after-converter" />);
    const buttons = container.querySelectorAll("button, a, [role='button']");
    expect(buttons.length).toBe(0);

    const text = container.textContent?.toLowerCase() || "";
    expect(text).not.toContain("download now");
    expect(text).not.toContain("click here");
    expect(text).not.toContain("start conversion");
    expect(text).not.toContain("continue to file");
  });
});
