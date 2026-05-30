// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  syncConfigPath,
  syncLogPath,
  defaultConflictPolicy,
  writeSyncConfig,
  readSyncConfig,
  patchSyncConfig,
  SYNC_STATE_DIR,
} from '../../src/lib/sync/config.js';
import type { SyncConfig } from '../../src/lib/sync/types.js';

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

function tmpDir(): string {
  const d = mkdtempSync(join(tmpdir(), 'vbrand-config-'));
  dirs.push(d);
  return d;
}

const MINIMAL_CONFIG: SyncConfig = {
  umbrellaUrl: 'file:///tmp/dist',
  publicKeyBase64: 'dGVzdA==',
  conflictPolicy: 'respect',
};

describe('syncConfigPath + syncLogPath', () => {
  it('config path is <cwd>/.vbrand/sync.config.json', () => {
    expect(syncConfigPath('/my/project')).toBe(`/my/project/${SYNC_STATE_DIR}/sync.config.json`);
  });

  it('log path is <cwd>/.vbrand/sync.log.jsonl', () => {
    expect(syncLogPath('/my/project')).toBe(`/my/project/${SYNC_STATE_DIR}/sync.log.jsonl`);
  });
});

describe('defaultConflictPolicy', () => {
  it('returns "respect"', () => {
    expect(defaultConflictPolicy()).toBe('respect');
  });
});

describe('writeSyncConfig + readSyncConfig', () => {
  it('roundtrips a complete SyncConfig', () => {
    const cwd = tmpDir();
    const config: SyncConfig = { ...MINIMAL_CONFIG, lastDigest: 'abc', distributionDir: '/out' };
    writeSyncConfig(cwd, config);
    expect(readSyncConfig(cwd)).toEqual(config);
  });

  it('creates the .vbrand directory if it does not exist', () => {
    const cwd = tmpDir();
    expect(existsSync(join(cwd, SYNC_STATE_DIR))).toBe(false);
    writeSyncConfig(cwd, MINIMAL_CONFIG);
    expect(existsSync(join(cwd, SYNC_STATE_DIR))).toBe(true);
  });

  it('throws a descriptive error when no config file exists', () => {
    const cwd = tmpDir();
    expect(() => readSyncConfig(cwd)).toThrow(/sync not initialised/i);
  });

  it('throws when the config file contains structurally invalid JSON', () => {
    const cwd = tmpDir();
    writeSyncConfig(cwd, MINIMAL_CONFIG);
    writeFileSync(syncConfigPath(cwd), 'not json', 'utf-8');
    expect(() => readSyncConfig(cwd)).toThrow();
  });

  it('throws when a required field is missing from the config file', () => {
    const cwd = tmpDir();
    writeSyncConfig(cwd, MINIMAL_CONFIG);
    const incomplete = { publicKeyBase64: MINIMAL_CONFIG.publicKeyBase64, conflictPolicy: MINIMAL_CONFIG.conflictPolicy };
    writeFileSync(syncConfigPath(cwd), JSON.stringify(incomplete), 'utf-8');
    expect(() => readSyncConfig(cwd)).toThrow();
  });
});

describe('patchSyncConfig', () => {
  it('updates only the specified field and preserves all others', () => {
    const cwd = tmpDir();
    writeSyncConfig(cwd, MINIMAL_CONFIG);
    patchSyncConfig(cwd, { conflictPolicy: 'force' });
    const result = readSyncConfig(cwd);
    expect(result.conflictPolicy).toBe('force');
    expect(result.umbrellaUrl).toBe(MINIMAL_CONFIG.umbrellaUrl);
    expect(result.publicKeyBase64).toBe(MINIMAL_CONFIG.publicKeyBase64);
  });

  it('sets lastDigest without affecting other fields', () => {
    const cwd = tmpDir();
    writeSyncConfig(cwd, MINIMAL_CONFIG);
    patchSyncConfig(cwd, { lastDigest: 'deadbeef' });
    const result = readSyncConfig(cwd);
    expect(result.lastDigest).toBe('deadbeef');
    expect(result.conflictPolicy).toBe(MINIMAL_CONFIG.conflictPolicy);
  });

  it('returns the updated SyncConfig', () => {
    const cwd = tmpDir();
    writeSyncConfig(cwd, MINIMAL_CONFIG);
    const updated = patchSyncConfig(cwd, { lastDigest: 'xyz' });
    expect(updated.lastDigest).toBe('xyz');
  });
});
