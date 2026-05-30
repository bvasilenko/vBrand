// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { ensureDir } from '../fs.js';
import type { SyncLogEntry } from './types.js';

export function appendLogEntry(logPath: string, entry: SyncLogEntry): void {
  ensureDir(dirname(logPath));
  appendFileSync(logPath, JSON.stringify(entry) + '\n', 'utf-8');
}

export function readLog(logPath: string): SyncLogEntry[] {
  if (!existsSync(logPath)) return [];
  return readFileSync(logPath, 'utf-8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as SyncLogEntry);
}

export function readLogSince(logPath: string, sinceDigest: string): SyncLogEntry[] {
  const all = readLog(logPath);
  let idx = -1;
  for (let i = all.length - 1; i >= 0; i--) {
    if (all[i]!.digest === sinceDigest) { idx = i; break; }
  }
  return idx === -1 ? all : all.slice(idx + 1);
}
