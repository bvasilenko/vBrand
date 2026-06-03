// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@booga/vbrand/adapters/browser': path.resolve('./dist/adapters-browser.js'),
      '@booga/vbrand/adapters':         path.resolve('./dist/adapters.js'),
      '@booga/vbrand/templates':        path.resolve('./dist/templates.js'),
      '@booga/vbrand/composition':      path.resolve('./dist/composition.js'),
      '@booga/vbrand/content':          path.resolve('./dist/content.js'),
      '@booga/vbrand/interactivity':    path.resolve('./dist/interactivity.js'),
    },
  },
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
    exclude: ['**/node_modules/**', '**/dist/**', 'examples/demo/tests/runtime-probe/**'],
  },
});
