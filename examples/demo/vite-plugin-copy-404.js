// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { copyFileSync } from 'node:fs';
import path from 'node:path';

export function viteCopy404Plugin() {
  let outDir = 'dist';

  return {
    name: 'vite-copy-404',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      const src = path.resolve(outDir, 'index.html');
      const dest = path.resolve(outDir, '404.html');
      copyFileSync(src, dest);
    },
  };
}
