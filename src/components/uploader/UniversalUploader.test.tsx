import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { UniversalUploader } from "./UniversalUploader";

describe("UniversalUploader Component", () => {
  it("renders upload dropzone title and button", () => {
    render(
      <UniversalUploader
        title="Custom Dropzone Title"
        subtitle="Select image or document"
      />
    );
    expect(screen.getByText("Custom Dropzone Title")).toBeDefined();
    expect(screen.getByText("Select image or document")).toBeDefined();
    expect(screen.getByText("Choose Files")).toBeDefined();
  });

  it("renders privacy label guarantee", () => {
    render(
      <UniversalUploader
        privacyLabel="100% Private local execution"
      />
    );
    expect(screen.getByText("100% Private local execution")).toBeDefined();
  });

  it("displays file size and batch limits correctly", () => {
    render(
      <UniversalUploader
        maxFileBytes={25 * 1024 * 1024}
        maxBatchCount={5}
      />
    );
    expect(screen.getByText(/Max 25 MB per file/i)).toBeDefined();
    expect(screen.getByText(/Up to 5 files/i)).toBeDefined();
  });

  it("rejects unknown-MIME spoofed images and unreadable files before conversion", async () => {
    const onFilesChange = vi.fn();
    render(<UniversalUploader allowedExtensions={["png"]} onFilesChange={onFilesChange} />);
    const spoof = new File(["not a PNG"], "spoof.png");
    const unreadable = new File(["unreadable"], "unreadable.png", { type: "image/png" });
    vi.spyOn(unreadable, "slice").mockImplementation(() => { throw new Error("Read failed"); });
    await act(async () => { fireEvent.change(screen.getByLabelText("Upload files"), { target: { files: [spoof, unreadable] } }); });
    expect(onFilesChange.mock.lastCall?.[0].map((file: {status: string}) => file.status)).toEqual(["corrupt", "corrupt"]);
  });

  it("reserves batch slots while header reads are still pending", async () => {
    const onFilesChange = vi.fn();
    render(<UniversalUploader maxBatchCount={1} onFilesChange={onFilesChange} />);
    let finish!: (buffer: ArrayBuffer) => void;
    const first = new File(["png header"], "first.png", { type: "image/png" });
    const header = first.slice();
    vi.spyOn(header, "arrayBuffer").mockReturnValue(new Promise(resolve => { finish = resolve; }));
    vi.spyOn(first, "slice").mockReturnValue(header);
    const input = screen.getByLabelText("Upload files");
    fireEvent.change(input, { target: { files: [first] } });
    fireEvent.change(input, { target: { files: [new File(["second"], "second.txt")] } });
    expect(screen.getByRole("alert").textContent).toContain("Maximum of 1 files");
    await act(async () => { finish(new Uint8Array([137,80,78,71,13,10,26,10]).buffer); });
    expect(onFilesChange.mock.lastCall?.[0].map((item: {file: File}) => item.file.name)).toEqual(["first.png"]);
  });

  it("does not restore a pending file after Clear all", async () => {
    const onFilesChange = vi.fn();
    render(<UniversalUploader onFilesChange={onFilesChange} />);
    const input = screen.getByLabelText("Upload files");
    await act(async () => { fireEvent.change(input, { target: { files: [new File(["text"], "first.txt")] } }); });
    let finish!: (buffer: ArrayBuffer) => void;
    const pending = new File(["png header"], "pending.png", { type: "image/png" });
    const header = pending.slice();
    vi.spyOn(header, "arrayBuffer").mockReturnValue(new Promise(resolve => { finish = resolve; }));
    vi.spyOn(pending, "slice").mockReturnValue(header);
    fireEvent.change(input, { target: { files: [pending] } });
    fireEvent.click(screen.getByRole("button", { name: /Clear all/ }));
    await act(async () => { finish(new Uint8Array([137,80,78,71,13,10,26,10]).buffer); });
    expect(onFilesChange.mock.lastCall?.[0]).toEqual([]);
  });
});
