// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { defineConfig } from 'vitest/config';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const { version } = JSON.parse(readFileSync(path.resolve('./package.json'), 'utf-8')) as { version: string };

export default defineConfig({
  define: { __VBRAND_VERSION__: JSON.stringify(version) },
  resolve: {
    alias: {
      '@booga/vbrand/adapters/browser': path.resolve('./dist/adapters-browser.js'),
      '@booga/vbrand/adapters':         path.resolve('./dist/adapters.js'),
      '@booga/vbrand/templates':        path.resolve('./dist/templates.js'),
      '@booga/vbrand/composition':      path.resolve('./dist/composition.js'),
      '@booga/vbrand/content':          path.resolve('./dist/content.js'),
      '@booga/vbrand/interactivity':    path.resolve('./dist/interactivity.js'),
      '@booga/vbrand/ssr':              path.resolve('./src/ssr/index.js'),
      '@booga/vbrand/stacks':           path.resolve('./src/stacks/index.ts'),
      '@booga/vbrand/cms':              path.resolve('./src/cms/index.ts'),
      '@booga/vbrand/deploy/metadata':  path.resolve('./src/deploy/metadata.ts'),
      '@booga/vbrand/deploy':           path.resolve('./src/deploy/index.ts'),
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
