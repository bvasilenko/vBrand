// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { mkdir, readFile, writeFile, appendFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { DeployHistoryEntry, DeployManifest } from './types.js';

export const DEFAULT_STATE_DIR = 'vbrand/.deploy';

export async function readManifest(cwd: string): Promise<DeployManifest> {
  const path = join(cwd, 'vbrand.deploy.json');
  const raw = await readFile(path, 'utf-8');
  return JSON.parse(raw) as DeployManifest;
}

export async function appendHistory(stateDir: string, entry: DeployHistoryEntry): Promise<void> {
  const path = join(stateDir, 'history.jsonl');
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, JSON.stringify(entry) + '\n', 'utf-8');
}

export async function readLastDeploy(stateDir: string): Promise<DeployHistoryEntry | null> {
  const path = join(stateDir, 'history.jsonl');
  try {
    const raw = await readFile(path, 'utf-8');
    const lines = raw.trim().split('\n').filter(Boolean);
    if (lines.length === 0) return null;
    return JSON.parse(lines[lines.length - 1]) as DeployHistoryEntry;
  } catch {
    return null;
  }
}

export interface DeployStateSummary {
  current: string | null;
  previous: string[];
}

export async function readRollbackPointers(stateDir: string): Promise<DeployStateSummary> {
  const path = join(stateDir, 'rollback', 'pointers.json');
  try {
    const raw = await readFile(path, 'utf-8');
    return JSON.parse(raw) as DeployStateSummary;
  } catch {
    return { current: null, previous: [] };
  }
}

export async function writeRollbackPointers(stateDir: string, summary: DeployStateSummary): Promise<void> {
  const path = join(stateDir, 'rollback', 'pointers.json');
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(summary, null, 2), 'utf-8');
}

export function recordDeploy(stateDir: string, imageRef: string, currentPointers: DeployStateSummary): DeployStateSummary {
  if (currentPointers.current === imageRef) return currentPointers;
  const previous = currentPointers.current
    ? [currentPointers.current, ...currentPointers.previous].slice(0, 5)
    : currentPointers.previous;
  return { current: imageRef, previous };
}

// Secret leak guard for vbrand/.deploy/. Greps the directory contents for shapes that
// suggest a credential value was written inadvertently.
const FORBIDDEN_PATTERNS = [
  /^Bearer\s+\S+/m,
  /_TOKEN\s*=/m,
  /BEGIN OPENSSH PRIVATE KEY/m,
  /BEGIN RSA PRIVATE KEY/m,
  /BEGIN PRIVATE KEY/m,
  /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/m, // JWT
];

export function findForbiddenPatterns(content: string): string[] {
  const matches: string[] = [];
  for (const pat of FORBIDDEN_PATTERNS) {
    const m = content.match(pat);
    if (m) matches.push(m[0].slice(0, 40));
  }
  return matches;
}
