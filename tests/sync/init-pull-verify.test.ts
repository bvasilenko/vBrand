// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { generateKeyPair, signBytes } from '../../src/lib/sync/sign.js';
import { HEAD_FILENAME } from '../../src/lib/sync/bundle-io.js';
import { runSyncInit, runSyncPull } from '../../src/lib/sync/pull.js';
import { runSyncVerify } from '../../src/lib/sync/status.js';
import { readSyncConfig, syncConfigPath } from '../../src/lib/sync/config.js';
import { readLog } from '../../src/lib/sync/log.js';
import { syncLogPath } from '../../src/lib/sync/config.js';
import { makeTmpDir, publishBundle, writeSeedSchema, UMBRELLA_SCHEMA } from './fixture.js';
import type { SyncHead } from '../../src/lib/sync/types.js';

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

function tmpDir(prefix = 'vbrand-sync-'): string {
  const d = makeTmpDir(prefix);
  dirs.push(d);
  return d;
}

describe('sync init — writes sync.config.json', () => {
  it('creates .vbrand/sync.config.json with umbrella URL, public key, and default policy', async () => {
    const cwd = tmpDir();
    const distDir = join(cwd, 'dist-umbrella');
    const kp = generateKeyPair();
    const umbrellaUrl = publishBundle(distDir, UMBRELLA_SCHEMA, kp);

    await runSyncInit({ cwd, umbrellaUrl });

    expect(existsSync(syncConfigPath(cwd))).toBe(true);
    const config = readSyncConfig(cwd);
    expect(config.umbrellaUrl).toBe(umbrellaUrl);
    expect(config.publicKeyBase64).toBe(kp.publicKeyBase64);
    expect(config.conflictPolicy).toBe('respect');
  });

  it('stores a custom conflict policy when provided', async () => {
    const cwd = tmpDir();
    const distDir = join(cwd, 'dist-umbrella');
    const kp = generateKeyPair();
    const umbrellaUrl = publishBundle(distDir, UMBRELLA_SCHEMA, kp);

    await runSyncInit({ cwd, umbrellaUrl, conflictPolicy: 'force' });

    expect(readSyncConfig(cwd).conflictPolicy).toBe('force');
  });

  it('throws when the umbrella URL is unreachable', async () => {
    const cwd = tmpDir();
    await expect(
      runSyncInit({ cwd, umbrellaUrl: 'file:///nonexistent-path-xyz/head.json' }),
    ).rejects.toThrow();
  });
});

describe('sync pull — idempotency and schema adoption', () => {
  let cwd: string;
  let umbrellaUrl: string;
  let kp: ReturnType<typeof generateKeyPair>;

  beforeEach(() => {
    cwd = tmpDir();
    const distDir = join(cwd, 'dist-umbrella');
    kp = generateKeyPair();
    umbrellaUrl = publishBundle(distDir, UMBRELLA_SCHEMA, kp);
    writeSeedSchema(cwd, UMBRELLA_SCHEMA);
  });

  it('writes the schema file and returns alreadyCurrent = false on first pull', async () => {
    await runSyncInit({ cwd, umbrellaUrl });
    const result = await runSyncPull({ cwd });
    expect(result.alreadyCurrent).toBe(false);
    expect(existsSync(join(cwd, 'vbrand.schema.json'))).toBe(true);
  });

  it('stores a non-empty lastDigest in sync.config.json after pull', async () => {
    await runSyncInit({ cwd, umbrellaUrl });
    await runSyncPull({ cwd });
    const config = readSyncConfig(cwd);
    expect(typeof config.lastDigest).toBe('string');
    expect((config.lastDigest ?? '').length).toBeGreaterThan(0);
  });

  it('second pull of the same head returns alreadyCurrent = true with no field changes', async () => {
    await runSyncInit({ cwd, umbrellaUrl });
    await runSyncPull({ cwd });
    const result2 = await runSyncPull({ cwd });
    expect(result2.alreadyCurrent).toBe(true);
    expect(result2.fieldsAdopted).toBe(0);
    expect(result2.fieldsHeld).toHaveLength(0);
  });

  it('idempotent pull makes no filesystem change to the schema file', async () => {
    await runSyncInit({ cwd, umbrellaUrl });
    await runSyncPull({ cwd });

    const { statSync } = await import('node:fs');
    const schemaPath = join(cwd, 'vbrand.schema.json');
    const mtime1 = statSync(schemaPath).mtimeMs;
    await runSyncPull({ cwd });
    const mtime2 = statSync(schemaPath).mtimeMs;

    expect(mtime2).toBe(mtime1);
  });

  it('pull appends a pull entry to .vbrand/sync.log.jsonl', async () => {
    await runSyncInit({ cwd, umbrellaUrl });
    await runSyncPull({ cwd });

    const entries = readLog(syncLogPath(cwd));
    expect(entries.filter((e) => e.op === 'pull').length).toBeGreaterThanOrEqual(1);
  });

  it('rejects pull when the signature is invalid', async () => {
    const evilKp = generateKeyPair();
    await runSyncInit({ cwd, umbrellaUrl });

    const distDir = join(cwd, 'dist-umbrella');
    const tamperedSig = signBytes(Buffer.from('tampered content'), evilKp.privateKeyBase64);
    writeFileSync(join(distDir, 'head.json.sig'), tamperedSig + '\n', 'utf-8');

    await expect(runSyncPull({ cwd })).rejects.toThrow(/Signature verification failed/);
  });

  it('rejects pull when the bundle digest mismatches the head', async () => {
    const distDir = join(cwd, 'dist-umbrella');
    await runSyncInit({ cwd, umbrellaUrl });

    const headContent = JSON.parse(
      (await import('node:fs')).readFileSync(join(distDir, HEAD_FILENAME), 'utf-8'),
    ) as SyncHead;
    const bundlePath = join(distDir, 'by-digest', `${headContent.digest}.json`);
    writeFileSync(bundlePath, JSON.stringify({ ...UMBRELLA_SCHEMA, name: 'tampered' }, null, 2));
    const headBytes = Buffer.from(JSON.stringify(headContent, null, 2) + '\n');
    writeFileSync(join(distDir, 'head.json.sig'), signBytes(headBytes, kp.privateKeyBase64) + '\n');

    await expect(runSyncPull({ cwd })).rejects.toThrow(/digest mismatch/);
  });
});

describe('sync verify — signature validation', () => {
  it('returns valid = true for a correctly signed distribution', async () => {
    const cwd = tmpDir();
    const distDir = join(cwd, 'dist-umbrella');
    const kp = generateKeyPair();
    const umbrellaUrl = publishBundle(distDir, UMBRELLA_SCHEMA, kp);
    writeSeedSchema(cwd, UMBRELLA_SCHEMA);

    await runSyncInit({ cwd, umbrellaUrl });
    await runSyncPull({ cwd });
    const result = await runSyncVerify({ cwd });

    expect(result.valid).toBe(true);
    expect(result.signatureOk).toBe(true);
    expect(result.handleLeakFindings).toHaveLength(0);
  });

  it('returns valid = false when head.json.sig does not match the public key', async () => {
    const cwd = tmpDir();
    const distDir = join(cwd, 'dist-umbrella');
    const kp = generateKeyPair();
    const evilKp = generateKeyPair();
    const umbrellaUrl = publishBundle(distDir, UMBRELLA_SCHEMA, kp);
    writeSeedSchema(cwd, UMBRELLA_SCHEMA);

    await runSyncInit({ cwd, umbrellaUrl });
    await runSyncPull({ cwd });

    const headBytes = (await import('node:fs')).readFileSync(join(distDir, HEAD_FILENAME));
    const badSig = signBytes(headBytes, evilKp.privateKeyBase64);
    writeFileSync(join(distDir, 'head.json.sig'), badSig + '\n');

    const result = await runSyncVerify({ cwd });
    expect(result.signatureOk).toBe(false);
    expect(result.valid).toBe(false);
  });

  it('throws a descriptive error when no pull has been performed yet', async () => {
    const cwd = tmpDir();
    const distDir = join(cwd, 'dist-umbrella');
    const kp = generateKeyPair();
    const umbrellaUrl = publishBundle(distDir, UMBRELLA_SCHEMA, kp);
    await runSyncInit({ cwd, umbrellaUrl });

    await expect(runSyncVerify({ cwd })).rejects.toThrow(/Nothing to verify/);
  });
});
