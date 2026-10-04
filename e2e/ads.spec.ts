import { test, expect } from "@playwright/test";

test.describe("Phase 10 — AdSense & Monetization Foundation", () => {
  test("/ads.txt route serves text/plain and pending notice or seller record", async ({ request }) => {
    const response = await request.get("/ads.txt");
    expect(response.status()).toBe(200);

    const contentType = response.headers()["content-type"];
    expect(contentType).toContain("text/plain");

    const cacheControl = response.headers()["cache-control"];
    expect(cacheControl).toContain("public");

    const text = await response.text();
    expect(text).toContain("# FileNimble ads.txt");
    expect(text).toContain("pending deployment");
  });

  test("ads are cleanly disabled by default (no ugly boxes or broken placeholders)", async ({ page }) => {
    // Check tool page
    await page.goto("/jpg-to-png");
    await page.waitForLoadState("domcontentloaded");

    // Live converter must be clearly visible
    const converter = page.locator("h1");
    await expect(converter).toBeVisible();

    // No ad slots should be visible when disabled
    const liveAds = page.locator("aside[aria-label='Advertisement']");
    await expect(liveAds).toHaveCount(0);

    const testAds = page.locator("aside[aria-label='Advertisement Preview']");
    await expect(testAds).toHaveCount(0);

    // No external Google AdSense script should be loaded
    const adsenseScripts = page.locator("script[src*='googlesyndication.com']");
    await expect(adsenseScripts).toHaveCount(0);
  });

  test("conversion controls are completely separated from any ad placements", async ({ page }) => {
    await page.goto("/jpg-to-png");
    await page.waitForLoadState("domcontentloaded");

    // The uploader dropzone must exist and be accessible
    const dropzone = page.getByRole("button", { name: /drop files here|browse files/i }).first();
    await expect(dropzone).toBeVisible();

    // Ensure the dropzone is not inside any aside or advertisement container
    const parentAside = dropzone.locator("xpath=ancestor::aside");
    await expect(parentAside).toHaveCount(0);
  });

  test("privacy page accurately discloses advertising cookies and absolute file isolation", async ({ page }) => {
    await page.goto("/privacy");
    await page.waitForLoadState("domcontentloaded");

    // Check that privacy sections render
    const heading = page.getByRole("heading", { name: /Cookies, advertising and operational information/i });
    await expect(heading).toBeVisible();

    // Verify key guarantees are present in body text
    const pageText = await page.textContent("main");
    expect(pageText).toContain("Google AdSense");
    expect(pageText).toContain("never shared with, processed by, or accessible to advertising services");
  });

  test("legal and trust pages remain strictly ad-free", async ({ page }) => {
    for (const path of ["/privacy", "/terms", "/about", "/contact"]) {
      await page.goto(path);
      await page.waitForLoadState("domcontentloaded");

      const adAsides = page.locator("aside[aria-label*='Advertisement']");
      await expect(adAsides).toHaveCount(0);
    }
  });

  test("planned converter pages do not display ads", async ({ page }) => {
    await page.goto("/heic-to-jpg");
    await page.waitForLoadState("domcontentloaded");

    const adAsides = page.locator("aside[aria-label*='Advertisement']");
    await expect(adAsides).toHaveCount(0);
  });

  test("responsive viewport has no horizontal overflow on mobile or desktop", async ({ page }) => {
    await page.goto("/jpg-to-png");
    await page.waitForLoadState("domcontentloaded");

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });
});
