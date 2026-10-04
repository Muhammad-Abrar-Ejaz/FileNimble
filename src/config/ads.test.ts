import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getAdConfig,
  formatPublisherId,
  isValidClientId,
  isAdSenseActive,
  isToolMonetizable,
  generateAdsTxtContent,
} from "./ads";
import { ToolRecord } from "@/types/tool";

describe("Ad Configuration & Helpers", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;
    delete process.env.NEXT_PUBLIC_ADSENSE_ENABLED;
    delete process.env.NEXT_PUBLIC_ADSENSE_TEST_MODE;
    delete process.env.NEXT_PUBLIC_CMP_ENABLED;
    delete process.env.NEXT_PUBLIC_CMP_SCRIPT_URL;
    delete process.env.NEXT_PUBLIC_ADS_TXT_CONTENT;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("formatPublisherId", () => {
    it("extracts pub-id from ca-pub format", () => {
      expect(formatPublisherId("ca-pub-1234567890123456")).toBe("pub-1234567890123456");
      expect(formatPublisherId("CA-PUB-9876543210987654")).toBe("pub-9876543210987654");
    });

    it("extracts pub-id if already in pub format", () => {
      expect(formatPublisherId("pub-1234567890123456")).toBe("pub-1234567890123456");
    });

    it("returns undefined for invalid format or missing input", () => {
      expect(formatPublisherId(undefined)).toBeUndefined();
      expect(formatPublisherId("")).toBeUndefined();
      expect(formatPublisherId("invalid-id")).toBeUndefined();
    });
  });

  describe("isValidClientId", () => {
    it("validates correct ca-pub-XXXXXXXXXXXXXXXX", () => {
      expect(isValidClientId("ca-pub-1234567890123456")).toBe(true);
      expect(isValidClientId("CA-PUB-1234567890123456")).toBe(true);
    });

    it("rejects invalid or incomplete IDs", () => {
      expect(isValidClientId(undefined)).toBe(false);
      expect(isValidClientId("")).toBe(false);
      expect(isValidClientId("ca-pub-123")).toBe(false);
      expect(isValidClientId("pub-1234567890123456")).toBe(false); // missing ca- prefix
      expect(isValidClientId("ca-pub-123456789012345a")).toBe(false); // non-digit
    });
  });

  describe("getAdConfig defaults", () => {
    it("defaults to disabled when env vars are absent", () => {
      const config = getAdConfig();
      expect(config.enabled).toBe(false);
      expect(config.testMode).toBe(false);
      expect(config.clientId).toBeUndefined();
      expect(config.cmp.enabled).toBe(false);
      expect(isAdSenseActive(config)).toBe(false);
    });

    it("enables when NEXT_PUBLIC_ADSENSE_ENABLED=true and valid client ID set", () => {
      process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID = "ca-pub-1234567890123456";
      process.env.NEXT_PUBLIC_ADSENSE_ENABLED = "true";

      const config = getAdConfig();
      expect(config.enabled).toBe(true);
      expect(config.clientId).toBe("ca-pub-1234567890123456");
      expect(isAdSenseActive(config)).toBe(false);
    });

    it("requires an enabled CMP with a valid HTTPS script URL", () => {
      process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID = "ca-pub-1234567890123456";
      process.env.NEXT_PUBLIC_ADSENSE_ENABLED = "true";
      process.env.NEXT_PUBLIC_CMP_ENABLED = "true";
      process.env.NEXT_PUBLIC_CMP_SCRIPT_URL = "https://cmp.example.test/tcf.js";

      expect(isAdSenseActive(getAdConfig())).toBe(true);

      process.env.NEXT_PUBLIC_CMP_SCRIPT_URL = "http://cmp.example.test/tcf.js";
      expect(isAdSenseActive(getAdConfig())).toBe(false);
      process.env.NEXT_PUBLIC_CMP_SCRIPT_URL = "javascript:alert(1)";
      expect(isAdSenseActive(getAdConfig())).toBe(false);
    });

    it("remains inactive in testMode even when enabled and client ID set", () => {
      process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID = "ca-pub-1234567890123456";
      process.env.NEXT_PUBLIC_ADSENSE_ENABLED = "true";
      process.env.NEXT_PUBLIC_ADSENSE_TEST_MODE = "true";
      process.env.NEXT_PUBLIC_CMP_ENABLED = "true";
      process.env.NEXT_PUBLIC_CMP_SCRIPT_URL = "https://cmp.example.test/tcf.js";

      const config = getAdConfig();
      expect(config.enabled).toBe(true);
      expect(config.testMode).toBe(true);
      expect(isAdSenseActive(config)).toBe(false);
    });
  });

  describe("isToolMonetizable policy QA", () => {
    it("returns true for live indexable tool", () => {
      const tool: ToolRecord = {
        id: "jpg_to_png",
        slug: "jpg-to-png",
        category: "image",
        status: "live",
        indexable: true,
        processingMode: "client",
      };
      expect(isToolMonetizable(tool)).toBe(true);
    });

    it("returns false for planned tools", () => {
      const tool: ToolRecord = {
        id: "pdf_to_docx",
        slug: "pdf-to-docx",
        category: "document_data",
        status: "planned",
        indexable: false,
        processingMode: "server",
      };
      expect(isToolMonetizable(tool)).toBe(false);
    });

    it("returns false for non-indexable tools", () => {
      const tool: ToolRecord = {
        id: "test_tool",
        slug: "test-tool",
        category: "pdf",
        status: "live",
        indexable: false,
        processingMode: "client",
      };
      expect(isToolMonetizable(tool)).toBe(false);
    });

    it("returns false for null or undefined", () => {
      expect(isToolMonetizable(null)).toBe(false);
      expect(isToolMonetizable(undefined)).toBe(false);
    });
  });

  describe("generateAdsTxtContent", () => {
    it("generates pending comment when no publisher ID is configured", () => {
      const content = generateAdsTxtContent({
        enabled: false,
        testMode: false,
        slots: {},
        cmp: { enabled: false },
      });
      expect(content).toContain("# FileNimble ads.txt");
      expect(content).toContain("pending deployment");
      expect(content).not.toContain("google.com, pub-");
    });

    it("generates valid AdSense seller record when client ID is configured", () => {
      const content = generateAdsTxtContent({
        clientId: "ca-pub-1234567890123456",
        enabled: true,
        testMode: false,
        slots: {},
        cmp: { enabled: false },
      });
      expect(content).toBe("google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n");
    });

    it("uses custom adsTxtOverride when provided", () => {
      const content = generateAdsTxtContent({
        enabled: true,
        testMode: false,
        slots: {},
        cmp: { enabled: false },
        adsTxtOverride: "google.com, pub-9999999999999999, DIRECT, f08c47fec0942fa0",
      });
      expect(content).toBe("google.com, pub-9999999999999999, DIRECT, f08c47fec0942fa0\n");
    });
  });
});
