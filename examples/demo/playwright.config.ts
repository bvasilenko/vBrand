// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const PREVIEW_PORT = 5290;
const PREVIEW_URL = `http://localhost:${PREVIEW_PORT}`;

export default defineConfig({
  testDir: path.join(__dirname, 'tests/runtime-probe'),
  timeout: 30_000,
  retries: process.env['CI'] ? 2 : 0,
  use: {
    baseURL: PREVIEW_URL,
  },
  webServer: {
    command: 'bun run preview',
    url: `${PREVIEW_URL}/vBrand/`,
    reuseExistingServer: true,
    cwd: __dirname,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
