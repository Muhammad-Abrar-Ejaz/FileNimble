import { test, expect } from "@playwright/test";

// Minimal valid 1x1 transparent PNG file bytes
const VALID_1X1_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
  0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
  0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
]);

test.describe("PNG to JPG Converter (Phase 2)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/png-to-jpg");
  });

  test("loads /png-to-jpg with correct H1, metadata, and browser privacy badge", async ({ page }) => {
    // Check page title
    await expect(page).toHaveTitle(/PNG to JPG Converter/i);

    // Check main H1
    const heading = page.locator("h1");
    await expect(heading).toContainText("PNG to JPG Converter");

    // Check privacy badge
    await expect(page.getByText("Runs in browser").first()).toBeVisible();

    // Check universal dropzone
    await expect(
      page.getByText("Drop PNG images here or click to browse")
    ).toBeVisible();
  });

  test("renders SEO guide, comparison table, transparency notice, and FAQs", async ({ page }) => {
    // Step by step guide
    await expect(page.getByText("How to Convert PNG to JPG Online")).toBeVisible();
    await expect(page.getByText("Upload PNG Files")).toBeVisible();

    // Comparison table
    await expect(page.getByText("PNG vs JPG: Key Differences")).toBeVisible();
    await expect(page.getByText("Important note regarding transparency in JPG files")).toBeVisible();

    // FAQ
    await expect(page.getByText("Frequently Asked Questions")).toBeVisible();
    await expect(page.getByText("Is PNG to JPG conversion free on FileNimble?")).toBeVisible();
    await expect(page.getByText("What happens to transparent PNG backgrounds?")).toBeVisible();
  });

  test("allows configuring quality slider and transparency background", async ({ page }) => {
    // Upload a valid PNG
    const fileInput = page.locator("input[type='file']");
    await fileInput.setInputFiles({
      name: "sample.png",
      mimeType: "image/png",
      buffer: VALID_1X1_PNG,
    });

    // Verify ready state and conversion settings card appear
    await expect(page.getByText("Conversion Settings")).toBeVisible();
    await expect(page.getByText("85%", { exact: true })).toBeVisible();

    // Change quality slider
    const slider = page.locator("#jpg-quality-slider");
    await expect(slider).toBeVisible();
    await slider.fill("95");
    await expect(page.getByText("95%", { exact: true })).toBeVisible();

    // Change background preset to Black
    const blackBtn = page.getByRole("button", { name: "Black" });
    await blackBtn.click();
    await expect(blackBtn).toHaveAttribute("aria-pressed", "true");
  });

  test("converts PNG to JPG directly in browser and enables download", async ({ page }) => {
    // Upload valid PNG
    const fileInput = page.locator("input[type='file']");
    await fileInput.setInputFiles({
      name: "diagram.png",
      mimeType: "image/png",
      buffer: VALID_1X1_PNG,
    });

    // Wait for file row
    await expect(page.getByText("diagram.png")).toBeVisible();
    await expect(page.getByText("Ready").first()).toBeVisible();

    // Click Convert to JPG
    const convertBtn = page.getByRole("button", { name: "Convert to JPG" });
    await expect(convertBtn).toBeEnabled();
    await convertBtn.click();

    // Verify conversion complete state
    await expect(page.getByText("Conversion Complete!")).toBeVisible();
    await expect(page.getByText("diagram.jpg")).toBeVisible();

    // Verify download button is available
    const downloadBtn = page.getByRole("link", { name: /Download/i });
    await expect(downloadBtn).toBeVisible();
    await expect(downloadBtn).toHaveAttribute("download", "diagram.jpg");

    // Verify "Convert Another" button works to reset
    const convertAnotherBtn = page.getByRole("button", { name: "Convert Another" });
    await expect(convertAnotherBtn).toBeVisible();
    await convertAnotherBtn.click();

    // Verify reset to dropzone
    await expect(page.getByText("Drop PNG images here or click to browse")).toBeVisible();
  });

  test("handles batch conversion of multiple PNG files with ZIP download", async ({ page }) => {
    const fileInput = page.locator("input[type='file']");
    await fileInput.setInputFiles([
      { name: "photo1.png", mimeType: "image/png", buffer: VALID_1X1_PNG },
      { name: "photo2.png", mimeType: "image/png", buffer: VALID_1X1_PNG },
    ]);

    await expect(page.getByText("photo1.png")).toBeVisible();
    await expect(page.getByText("photo2.png")).toBeVisible();

    // Convert all
    const convertBtn = page.getByRole("button", { name: "Convert to JPG" });
    await convertBtn.click();

    // Verify both converted
    await expect(page.getByText("Conversion Complete!")).toBeVisible();
    await expect(page.getByText("photo1.jpg")).toBeVisible();
    await expect(page.getByText("photo2.jpg")).toBeVisible();

    // Verify "Download All (ZIP)" button appears
    const downloadAllBtn = page.getByRole("button", { name: "Download All (ZIP)" });
    await expect(downloadAllBtn).toBeVisible();
  });

  test("works responsively on mobile viewport (375px)", async ({ page, isMobile }) => {
    if (!isMobile) {
      await page.setViewportSize({ width: 375, height: 667 });
    }

    await expect(page.locator("h1")).toBeVisible();
    await expect(
      page.getByText("Drop PNG images here or click to browse")
    ).toBeVisible();
    await expect(page.getByText("How to Convert PNG to JPG Online")).toBeVisible();
  });
});
