// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/cli.ts', 'src/adapters/browser-index.ts', 'src/adapters/brand-source/browser-adapter.ts', 'src/adapters/brand-source/html-brand-extractor.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
    testTimeout: 60000,
  },
});
