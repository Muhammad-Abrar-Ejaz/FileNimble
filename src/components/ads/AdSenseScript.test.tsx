import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdSenseScript } from "./AdSenseScript";

vi.mock("next/script", () => ({
  default: ({
    id,
    src,
    onReady,
    onError,
  }: {
    id: string;
    src: string;
    onReady?: () => void;
    onError?: () => void;
  }) => (
    <button
      type="button"
      data-testid={id}
      data-src={src}
      onClick={() => onReady?.()}
      onDoubleClick={() => onError?.()}
    />
  ),
}));

describe("AdSenseScript consent gate", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID = "ca-pub-1234567890123456";
    process.env.NEXT_PUBLIC_ADSENSE_ENABLED = "true";
    process.env.NEXT_PUBLIC_CMP_ENABLED = "true";
    process.env.NEXT_PUBLIC_CMP_SCRIPT_URL = "https://cmp.example.test/tcf.js";
    delete process.env.NEXT_PUBLIC_ADSENSE_TEST_MODE;
    delete window.__tcfapi;
  });

  afterEach(() => {
    process.env = originalEnv;
    delete window.__tcfapi;
  });

  it("does not render either script without a valid CMP configuration", () => {
    process.env.NEXT_PUBLIC_CMP_ENABLED = "false";

    const { container } = render(<AdSenseScript />);

    expect(container.firstChild).toBeNull();
  });

  it("loads AdSense only after the CMP reports an explicit consent grant", () => {
    let tcfCallback: ((data: unknown, success: boolean) => void) | undefined;
    window.__tcfapi = vi.fn((_command, _version, callback) => {
      tcfCallback = callback;
    });

    render(<AdSenseScript />);
    expect(screen.getByTestId("filenimble-cmp-script")).toBeDefined();
    expect(screen.queryByTestId("filenimble-adsense-script")).toBeNull();

    fireEvent.click(screen.getByTestId("filenimble-cmp-script"));
    act(() => {
      tcfCallback?.(
        { eventStatus: "useractioncomplete", gdprApplies: true, purpose: { consents: { 1: true } } },
        true
      );
    });

    expect(screen.getByTestId("filenimble-adsense-script")).toBeDefined();
  });

  it("keeps AdSense unloaded when consent is denied or the TCF API is unavailable", () => {
    let tcfCallback: ((data: unknown, success: boolean) => void) | undefined;
    window.__tcfapi = vi.fn((_command, _version, callback) => {
      tcfCallback = callback;
    });

    const { rerender } = render(<AdSenseScript />);
    fireEvent.click(screen.getByTestId("filenimble-cmp-script"));
    act(() => {
      tcfCallback?.(
        { eventStatus: "tcloaded", gdprApplies: true, purpose: { consents: { 1: false } } },
        true
      );
    });
    expect(screen.queryByTestId("filenimble-adsense-script")).toBeNull();

    delete window.__tcfapi;
    rerender(<AdSenseScript />);
    expect(screen.queryByTestId("filenimble-adsense-script")).toBeNull();
  });

  it("fails closed when the CMP script errors", () => {
    const { container } = render(<AdSenseScript />);
    fireEvent.doubleClick(screen.getByTestId("filenimble-cmp-script"));
    expect(container.querySelector('[data-testid="filenimble-adsense-script"]')).toBeNull();
  });
});
