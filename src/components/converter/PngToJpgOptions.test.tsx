import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { PngToJpgOptions } from "./PngToJpgOptions";

describe("PngToJpgOptions Component", () => {
  it("renders quality slider and transparency background controls with touch-target sizing", () => {
    const onQualityChange = vi.fn();
    const onBackgroundColorChange = vi.fn();

    render(
      <PngToJpgOptions
        quality={0.85}
        onQualityChange={onQualityChange}
        backgroundColor="#FFFFFF"
        onBackgroundColorChange={onBackgroundColorChange}
      />
    );

    // Verify preset buttons have 44px touch target height and touch-manipulation
    const whiteBtn = screen.getByRole("button", { name: /^White$/i });
    const blackBtn = screen.getByRole("button", { name: /^Black$/i });

    expect(whiteBtn.className).toContain("min-h-[44px]");
    expect(whiteBtn.className).toContain("touch-manipulation");
    expect(blackBtn.className).toContain("min-h-[44px]");
    expect(blackBtn.className).toContain("touch-manipulation");

    // Verify custom color picker has min-h-[44px] container and w-7 h-7 input with label
    const colorInput = screen.getByLabelText("Pick custom background color");
    expect(colorInput).toBeDefined();
    expect(colorInput.className).toContain("w-7");
    expect(colorInput.className).toContain("h-7");

    const colorContainer = colorInput.closest("div");
    expect(colorContainer?.className).toContain("min-h-[44px]");
    expect(colorContainer?.className).toContain("touch-manipulation");

    // Verify interactions
    fireEvent.click(blackBtn);
    expect(onBackgroundColorChange).toHaveBeenCalledWith("#000000");

    fireEvent.change(colorInput, { target: { value: "#123456" } });
    expect(onBackgroundColorChange).toHaveBeenCalledWith("#123456");
  });
});
