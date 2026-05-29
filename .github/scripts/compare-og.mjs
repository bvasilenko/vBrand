// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
// CI helper: pixel-level cross-arch OG equivalence check.
// Usage: bun run .github/scripts/compare-og.mjs <reference.png> <actual.png>
// Exits 1 if pixel diff ratio exceeds 1% at threshold 0.1.
import sharp from 'sharp';
import pixelmatch from 'pixelmatch';
import { resolve } from 'node:path';

const [refPath, actualPath] = process.argv.slice(2);
if (!refPath || !actualPath) {
  console.error('Usage: compare-og.mjs <reference.png> <actual.png>');
  process.exit(1);
}

const ref = await sharp(resolve(refPath)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const actual = await sharp(resolve(actualPath)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

if (ref.info.width !== actual.info.width || ref.info.height !== actual.info.height) {
  console.error(
    'dimension mismatch: ref=' +
      ref.info.width +
      'x' +
      ref.info.height +
      ' actual=' +
      actual.info.width +
      'x' +
      actual.info.height,
  );
  process.exit(1);
}

const diff = pixelmatch(
  new Uint8Array(ref.data),
  new Uint8Array(actual.data),
  null,
  ref.info.width,
  ref.info.height,
  { threshold: 0.1 },
);

const total = ref.info.width * ref.info.height;
const pct = diff / total;
console.log('cross-arch OG pixel diff: ' + diff + '/' + total + ' (' + (pct * 100).toFixed(2) + '%)');

if (pct > 0.01) {
  console.error('FAIL: pixel diff ' + (pct * 100).toFixed(2) + '% exceeds 1% tolerance (threshold=0.1)');
  process.exit(1);
}
console.log('cross-arch OG pixel equivalence OK');
