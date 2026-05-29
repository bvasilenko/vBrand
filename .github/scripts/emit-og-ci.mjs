// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
// CI helper: emit a reference OG image for cross-arch pixel comparison.
// Usage: bun run .github/scripts/emit-og-ci.mjs <output-path>
import sharp from 'sharp';
import { copyFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { runEmit } from '../../src/commands/emit.js';
import { SCHEMA_FILENAME } from '../../src/schema.js';

const outputPath = process.argv[2];
if (!outputPath) {
  console.error('Usage: emit-og-ci.mjs <output-path>');
  process.exit(1);
}

const dir = mkdtempSync(join(tmpdir(), 'vbrand-ci-og-'));

await sharp({
  create: { width: 512, height: 512, channels: 4, background: { r: 99, g: 102, b: 241, alpha: 255 } },
}).png().toFile(join(dir, 'logo.png'));

writeFileSync(
  join(dir, SCHEMA_FILENAME),
  JSON.stringify(
    {
      name: 'ci-og-ref',
      voice: { canonical: 'CI.', repoDescription: 'CI OG reference.' },
      assets: {
        favicon: { source: 'logo.png', sizes: [32] },
        og: { dimensions: [1200, 630] },
        icons: { source: 'icons/', set: [] },
      },
      tokens: {
        color: { primary: '#6366f1' },
        type: { sans: 'Inter, sans-serif' },
      },
    },
    null,
    2,
  ),
  'utf-8',
);

await runEmit({ cwd: dir });
copyFileSync(join(dir, 'public', 'brand', 'og.png'), resolve(outputPath));
console.log('OG image written to ' + outputPath);
