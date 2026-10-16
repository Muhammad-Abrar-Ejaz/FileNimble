import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const testUrl = new URL(baseURL);
if (testUrl.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(testUrl.hostname)) {
  throw new Error('Playwright must target a local HTTP server.');
}
const serverCommand = process.env.PLAYWRIGHT_SERVER_MODE === 'production'
  ? `npm run start -- --hostname 127.0.0.1 --port ${testUrl.port || '80'}`
  : `npm run dev -- --hostname 127.0.0.1 --port ${testUrl.port || '80'}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL,
    acceptDownloads: true,
    navigationTimeout: 30_000,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "Mobile Chrome",
      use: { ...devices["Pixel 5"] },
    },
    {
      name: "Mobile Safari",
      use: { ...devices["iPhone 12"] },
    },
  ],
  webServer: {
    command: serverCommand,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
