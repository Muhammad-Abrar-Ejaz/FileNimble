import { defineConfig } from '@playwright/test';
import base from './playwright.backend.config';
export default defineConfig({ ...base, testMatch: /phase11\.spec\.ts/ });
