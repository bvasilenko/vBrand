// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { defineConfig } from 'tsup';

const REACT_EXTERNALS = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/server',
];

const VBLOCK_EXTERNALS = [
  '@booga/vblocks/hero',
  '@booga/vblocks/features',
  '@booga/vblocks/cta',
  '@booga/vblocks/footer',
  '@booga/vblocks/testimonial',
  '@booga/vui',
];

export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    format: ['esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    target: 'es2022',
  },
  {
    entry: { cli: 'src/cli.ts' },
    format: ['esm'],
    dts: false,
    sourcemap: true,
    banner: { js: '#!/usr/bin/env node' },
    target: 'es2022',
    noExternal: [],
  },
  {
    entry: { adapters: 'src/adapters/index.ts' },
    format: ['esm'],
    dts: true,
    sourcemap: true,
    target: 'es2022',
    external: ['@booga/vfixtures'],
  },
  {
    entry: { 'adapters-browser': 'src/adapters/browser-index.ts' },
    format: ['esm'],
    dts: true,
    sourcemap: true,
    target: 'es2022',
    platform: 'browser',
    external: ['@booga/vfixtures'],
  },
  {
    entry: { templates: 'src/templates/index.ts' },
    format: ['esm'],
    dts: true,
    sourcemap: true,
    target: 'es2022',
    external: [...REACT_EXTERNALS, ...VBLOCK_EXTERNALS],
    esbuildOptions(options) {
      options.jsx = 'automatic';
    },
  },
  {
    entry: { composition: 'src/composition/index.ts' },
    format: ['esm'],
    dts: true,
    sourcemap: true,
    target: 'es2022',
    external: [...REACT_EXTERNALS, '@booga/vui'],
    esbuildOptions(options) {
      options.jsx = 'automatic';
    },
  },
  {
    entry: { content: 'src/content/index.ts' },
    format: ['esm'],
    dts: true,
    sourcemap: true,
    target: 'es2022',
    external: ['zod'],
  },
  {
    entry: { interactivity: 'src/interactivity/index.ts' },
    format: ['esm'],
    dts: true,
    sourcemap: true,
    target: 'es2022',
    external: [...REACT_EXTERNALS],
    esbuildOptions(options) {
      options.jsx = 'automatic';
    },
  },
  {
    entry: { ssr: 'src/ssr/index.ts' },
    format: ['esm'],
    dts: true,
    sourcemap: true,
    target: 'es2022',
    external: [...REACT_EXTERNALS],
    esbuildOptions(options) {
      options.jsx = 'automatic';
    },
  },
]);
