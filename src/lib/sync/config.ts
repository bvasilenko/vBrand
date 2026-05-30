// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { ensureDir } from '../fs.js';
import type { SyncConfig, ConflictPolicy } from './types.js';

export const SYNC_STATE_DIR = '.vbrand';
const SYNC_CONFIG_FILENAME = 'sync.config.json';

const ConflictPolicySchema = z.enum(['respect', 'force', 'warn']);

const SyncConfigSchema = z.object({
  umbrellaUrl: z.string().url(),
  publicKeyBase64: z.string().min(1),
  conflictPolicy: ConflictPolicySchema,
  lastDigest: z.string().optional(),
  distributionDir: z.string().optional(),
});

export function syncConfigPath(cwd: string): string {
  return join(cwd, SYNC_STATE_DIR, SYNC_CONFIG_FILENAME);
}

export function syncLogPath(cwd: string): string {
  return join(cwd, SYNC_STATE_DIR, 'sync.log.jsonl');
}

export function readSyncConfig(cwd: string): SyncConfig {
  const path = syncConfigPath(cwd);
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    throw new Error(
      `Sync not initialised in this directory. Run: vbrand sync init <umbrella-url>`,
    );
  }
  return SyncConfigSchema.parse(raw) as SyncConfig;
}

export function writeSyncConfig(cwd: string, config: SyncConfig): void {
  const path = syncConfigPath(cwd);
  ensureDir(join(cwd, SYNC_STATE_DIR));
  writeFileSync(path, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

export function patchSyncConfig(
  cwd: string,
  patch: Partial<SyncConfig>,
): SyncConfig {
  const current = readSyncConfig(cwd);
  const updated: SyncConfig = { ...current, ...patch };
  writeSyncConfig(cwd, updated);
  return updated;
}

export function defaultConflictPolicy(): ConflictPolicy {
  return 'respect';
}
