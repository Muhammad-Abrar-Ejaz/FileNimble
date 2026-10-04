import { test, expect } from "@playwright/test";

test.describe("FileNimble Homepage & Core Shell (Phase 1)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("renders header with brand logo and main navigation", async ({ page }) => {
    // Brand logo
    const logo = page.locator("header img[alt='FileNimble Logo']");
    await expect(logo).toBeVisible();

    // Brand wordmark
    await expect(page.locator("header").getByText("FileNimble")).toBeVisible();

    // Skip to content link
    const skipLink = page.locator("a", { hasText: "Skip to main content" });
    await expect(skipLink).toHaveAttribute("href", "#main-content");
  });

  test("renders hero section with tagline and value propositions", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Any file. Right format.");
    await expect(page.getByText("Convert images, organize PDF pages, recognize scanned English text")).toBeVisible();
    await expect(page.getByText("Clear processing labels")).toBeVisible();
  });

  test("renders universal uploader scaffold", async ({ page }) => {
    const dropzone = page.getByRole("button", { name: /Drop files here/i });
    await expect(dropzone).toBeVisible();
    await expect(page.getByText("Choose Files")).toBeVisible();
    await expect(page.getByText(/validated locally in your browser/i)).toBeVisible();
  });

  test("allows searching and filtering tools interactively", async ({ page }) => {
    const searchInput = page.getByPlaceholder(/Search all 130\+ tools/i);
    await expect(searchInput).toBeVisible();

    // Search for "jpg"
    await searchInput.fill("jpg");
    await expect(page.getByText(/matching "jpg"/i)).toBeVisible();

    // Verify search results contain JPG tools
    const toolCards = page.locator("article");
    const count = await toolCards.count();
    expect(count).toBeGreaterThan(0);

    // Clear search
    await searchInput.fill("");
  });

  test("renders category explorer grid with tool counts", async ({ page }) => {
    const categorySection = page.locator("#categories");
    await expect(categorySection).toBeVisible();
    await expect(categorySection.getByText("PDF Tools")).toBeVisible();
    await expect(categorySection.getByText("Image Tools")).toBeVisible();
    await expect(categorySection.getByText("Documents & Data")).toBeVisible();
  });

  test("renders workflow and privacy sections", async ({ page }) => {
    await expect(page.getByText("Simple 3-Step Workflow")).toBeVisible();
    await expect(page.getByText("Your files belong to you. Always.")).toBeVisible();
    await expect(page.getByText("Zero telemetry on file contents")).toBeVisible();
  });

  test("renders professional footer with links", async ({ page }) => {
    const footer = page.locator("footer");
    await expect(footer).toBeVisible();
    await expect(footer.getByText("Any file. Right format.")).toBeVisible();
    await expect(footer.getByText("File Categories")).toBeVisible();
    await expect(footer.getByText("Platform")).toBeVisible();
  });

  test("supports mobile navigation drawer on mobile viewports", async ({ page, isMobile }) => {
    if (!isMobile) {
      // Resize to mobile viewport to test responsive drawer
      await page.setViewportSize({ width: 375, height: 667 });
    }

    const menuButton = page.getByRole("button", { name: "Open mobile navigation menu" });
    await expect(menuButton).toBeVisible();

    // Open mobile menu
    await menuButton.click();
    const mobileDialog = page.getByRole("dialog", { name: "Mobile Navigation Menu" });
    await expect(mobileDialog).toBeVisible();

    // Close mobile menu
    const closeButton = page.getByRole("button", { name: "Close navigation menu" });
    await closeButton.click();
    await expect(mobileDialog).not.toBeVisible();
  });
});
