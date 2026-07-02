// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { viteCopy404Plugin } from './vite-plugin-copy-404.js';
import { stampVersionIntoHtml } from './vite-html-transform.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = path.resolve(__dirname, '../..');

const base = process.env.VITE_BASE ?? '/vBrand/';
const { version } = JSON.parse(readFileSync(path.resolve(root, 'package.json'), 'utf-8'));

function vbrandVersionHtmlPlugin() {
  return {
    name: 'vbrand-version-html',
    transformIndexHtml(html) {
      return stampVersionIntoHtml(html, version);
    },
  };
}

export default defineConfig({
  plugins: [react(), viteCopy404Plugin(), vbrandVersionHtmlPlugin()],
  define: { __VBRAND_VERSION__: JSON.stringify(version) },
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
      '@booga/vbrand/stacks':           path.resolve(root, 'dist/stacks.js'),
      '@booga/vbrand/cms':              path.resolve(root, 'dist/cms.js'),
      '@booga/vbrand/deploy/metadata':  path.resolve(root, 'dist/deploy-metadata.js'),
      '@booga/vbrand/deploy':           path.resolve(root, 'dist/deploy.js'),
    },
  },
});
