import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { GET } from "./route";

describe("/ads.txt Route", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;
    delete process.env.NEXT_PUBLIC_ADS_TXT_CONTENT;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns 200 with text/plain content type and pending note when not configured", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");

    const text = await response.text();
    expect(text).toContain("# FileNimble ads.txt");
    expect(text).toContain("pending deployment");
    expect(text).not.toContain("docs/");
  });

  it("returns standard Google seller record when client ID is provided", async () => {
    process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID = "ca-pub-9988776655443322";

    const response = await GET();
    expect(response.status).toBe(200);

    const text = await response.text();
    expect(text).toBe("google.com, pub-9988776655443322, DIRECT, f08c47fec0942fa0\n");
  });
});
