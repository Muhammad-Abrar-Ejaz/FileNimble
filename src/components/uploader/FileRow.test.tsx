import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { FileRow, ValidatedFile } from "./FileRow";

describe("FileRow Component", () => {
  const sampleFile: ValidatedFile = {
    id: "file-1",
    file: new File(["content"], "sample.png", { type: "image/png" }),
    status: "valid",
  };

  it("renders filename, size, and accessible remove button with mobile touch target", () => {
    const onRemove = vi.fn();
    render(
      <FileRow
        item={sampleFile}
        index={0}
        totalCount={1}
        onRemove={onRemove}
      />
    );

    expect(screen.getByText("sample.png")).toBeDefined();

    const removeBtn = screen.getByRole("button", { name: /Remove sample\.png/i });
    expect(removeBtn).toBeDefined();
    // Verify touch target size and mobile classes
    expect(removeBtn.className).toContain("min-h-[44px]");
    expect(removeBtn.className).toContain("min-w-[44px]");
    expect(removeBtn.className).toContain("touch-manipulation");

    fireEvent.click(removeBtn);
    expect(onRemove).toHaveBeenCalledWith("file-1");
  });

  it("renders reorder controls with min-h-[44px] when allowReorder is enabled", () => {
    const onMoveUp = vi.fn();
    const onMoveDown = vi.fn();

    render(
      <FileRow
        item={sampleFile}
        index={0}
        totalCount={3}
        onRemove={vi.fn()}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        allowReorder={true}
      />
    );

    const moveUpBtn = screen.getByRole("button", { name: /Move sample\.png up/i });
    const moveDownBtn = screen.getByRole("button", { name: /Move sample\.png down/i });

    expect(moveUpBtn.className).toContain("min-h-[44px]");
    expect(moveUpBtn.className).toContain("min-w-[44px]");
    expect(moveUpBtn.className).toContain("touch-manipulation");
    expect(moveDownBtn.className).toContain("min-h-[44px]");
    expect(moveDownBtn.className).toContain("min-w-[44px]");
    expect(moveDownBtn.className).toContain("touch-manipulation");

    // First item cannot move up
    expect((moveUpBtn as HTMLButtonElement).disabled).toBe(true);
    expect((moveDownBtn as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(moveDownBtn);
    expect(onMoveDown).toHaveBeenCalledWith(0);
  });
});
