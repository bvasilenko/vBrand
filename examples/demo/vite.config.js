// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { viteCopy404Plugin } from './vite-plugin-copy-404.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = path.resolve(__dirname, '../..');

const base = process.env.VITE_BASE ?? '/vBrand/';

export default defineConfig({
  plugins: [react(), viteCopy404Plugin()],
  base,
  server: { port: 5290 },
  resolve: {
    alias: {
      '@booga/vbrand/adapters/browser': path.resolve(root, 'dist/adapters-browser.js'),
      '@booga/vbrand/templates': path.resolve(root, 'dist/templates.js'),
      '@booga/vbrand/composition': path.resolve(root, 'dist/composition.js'),
      '@booga/vbrand/content': path.resolve(root, 'dist/content.js'),
      '@booga/vbrand/interactivity': path.resolve(root, 'dist/interactivity.js'),
      '@booga/vbrand/ssr':              path.resolve(root, 'dist/ssr.js'),
    },
  },
});
