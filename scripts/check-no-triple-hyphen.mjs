// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import fs from 'node:fs';
import path from 'node:path';

const DIST_DIR = path.resolve(import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname), '..', 'dist');
const TRIPLE_HYPHEN = '--v---';

const jsFiles = fs.readdirSync(DIST_DIR).filter((f) => f.endsWith('.js'));
const violations = jsFiles.filter((f) =>
  fs.readFileSync(path.join(DIST_DIR, f), 'utf-8').includes(TRIPLE_HYPHEN),
);

if (violations.length > 0) {
  console.error(`Triple-hyphen mangled CSS variable pattern found in dist:\n  ${violations.join('\n  ')}`);
  process.exit(1);
}
