import { defineConfig } from '@playwright/test';
import backend from './playwright.backend.config';

export default defineConfig({
  ...backend,
  testMatch: 'ocr.spec.ts',
  webServer: {
    command: 'node scripts/backend-web.mjs dev 3100',
    url: 'http://localhost:3100',
    reuseExistingServer: false,
    timeout: 120000,
  },
});
