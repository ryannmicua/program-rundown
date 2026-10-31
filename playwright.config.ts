import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: 'e2e', workers: 1, use: { browserName: 'chromium', headless: true }, reporter: 'list', outputDir: process.env.PLAYWRIGHT_OUTPUT_DIR || '/tmp/program-rundown-playwright' });
