import fs from 'node:fs';
import { defineConfig } from '@playwright/test';
const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', import.meta.url)));
export default defineConfig({
  testDir: '.', testMatch: manifest.testMatch, retries: 0, workers: 1,
  reporter: 'list', use: { headless: true },
});
