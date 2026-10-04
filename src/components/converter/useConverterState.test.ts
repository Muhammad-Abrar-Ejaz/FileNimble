import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useConverterState } from "./useConverterState";
import { ValidatedFile } from "../uploader/FileRow";

describe("useConverterState Hook", () => {
  const dummyFile = new File(["sample content"], "sample.png", { type: "image/png" });
  const validItem: ValidatedFile = {
    id: "f1",
    file: dummyFile,
    status: "valid",
    statusMessage: "Ready",
  };

  it("initializes with idle state", () => {
    const { result } = renderHook(() => useConverterState());
    expect(result.current.state.status).toBe("idle");
    expect(result.current.state.files).toEqual([]);
    expect(result.current.state.errorCode).toBeNull();
  });

  it("transitions to ready when valid files are added", () => {
    const { result } = renderHook(() => useConverterState());
    act(() => {
      result.current.setFiles([validItem]);
    });
    expect(result.current.state.status).toBe("ready");
    expect(result.current.state.files.length).toBe(1);
  });

  it("transitions to processing and completes successfully", () => {
    const { result } = renderHook(() => useConverterState());
    act(() => {
      result.current.setFiles([validItem]);
    });
    act(() => {
      result.current.startProcessing("Converting PNG to JPG...");
    });
    expect(result.current.state.status).toBe("processing");
    expect(result.current.state.processingMessage).toBe("Converting PNG to JPG...");

    act(() => {
      result.current.setComplete([
        {
          name: "sample.jpg",
          size: 1024,
          blobUrl: "blob:http://localhost/123",
        },
      ]);
    });
    expect(result.current.state.status).toBe("complete");
    expect(result.current.state.resultFiles.length).toBe(1);
    expect(result.current.state.resultFiles[0].name).toBe("sample.jpg");
  });

  it("handles failure state transition with error codes", () => {
    const { result } = renderHook(() => useConverterState());
    act(() => {
      result.current.setFailed("CORRUPT_FILE", "The input file header was damaged.");
    });
    expect(result.current.state.status).toBe("failed");
    expect(result.current.state.errorCode).toBe("CORRUPT_FILE");
    expect(result.current.state.errorMessage).toBe("The input file header was damaged.");
  });

  it("handles cancellation and reset transitions", () => {
    const { result } = renderHook(() => useConverterState());
    act(() => {
      result.current.cancel();
    });
    expect(result.current.state.status).toBe("cancelled");

    act(() => {
      result.current.reset();
    });
    expect(result.current.state.status).toBe("idle");
    expect(result.current.state.files).toEqual([]);
  });
});
