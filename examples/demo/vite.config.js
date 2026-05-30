// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Base path for GitHub Pages hosting at https://bvasilenko.github.io/vBrand/.
// Override via VITE_BASE=/ for local dev or other deploy targets.
const base = process.env.VITE_BASE ?? '/vBrand/';

export default defineConfig({
  plugins: [react()],
  base,
  server: { port: 5290 },
});
