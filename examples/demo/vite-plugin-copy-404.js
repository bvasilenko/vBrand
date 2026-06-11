// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { copyFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const CLIENT_ROUTES = ['data'];

export function viteCopy404Plugin() {
  let outDir = 'dist';

  return {
    name: 'vite-copy-404',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      const src = path.resolve(outDir, 'index.html');
      copyFileSync(src, path.resolve(outDir, '404.html'));
      for (const route of CLIENT_ROUTES) {
        const routeDir = path.resolve(outDir, route);
        mkdirSync(routeDir, { recursive: true });
        copyFileSync(src, path.resolve(routeDir, 'index.html'));
      }
    },
  };
}
