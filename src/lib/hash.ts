// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { walkFiles } from './fs.js';

export function hashFile(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

export function hashDir(dir: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const file of walkFiles(dir)) {
    map.set(relative(dir, file), hashFile(file));
  }
  return map;
}

export function diffDirHashes(
  expected: Map<string, string>,
  actual: Map<string, string>,
): string[] {
  const drifted: string[] = [];
  for (const [rel, hash] of expected) {
    if (actual.get(rel) !== hash) drifted.push(rel);
  }
  for (const rel of actual.keys()) {
    if (!expected.has(rel)) drifted.push(rel);
  }
  return [...new Set(drifted)].sort();
}
