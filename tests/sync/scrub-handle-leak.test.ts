// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { scrubHandles, auditPostScrub } from '../../src/lib/sync/scrub.js';
import { scanForHandleLeaks } from '../../src/lib/sync/handle-audit.js';
import { generateKeyPair, signBytes } from '../../src/lib/sync/sign.js';
import { digestJson } from '../../src/lib/sync/digest.js';
import { writeBundleToDir } from '../../src/lib/sync/bundle-io.js';
import { runSyncPush } from '../../src/lib/sync/push.js';
import { runSyncInit, runSyncPull } from '../../src/lib/sync/pull.js';
import { runSyncVerify } from '../../src/lib/sync/status.js';
import { readLog } from '../../src/lib/sync/log.js';
import { syncLogPath } from '../../src/lib/sync/config.js';
import { makeTmpDir, UMBRELLA_SCHEMA } from './fixture.js';
import type { SyncHead } from '../../src/lib/sync/types.js';

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

function tmpDir(prefix = 'vbrand-scrub-'): string {
  const d = makeTmpDir(prefix);
  dirs.push(d);
  return d;
}

describe('scanForHandleLeaks — unit', () => {
  it('detects a long handle (>6 chars) anywhere as a substring', () => {
    const findings = scanForHandleLeaks({ name: 'internal-acmecorp' }, ['acmecorp']);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.handle).toBe('acmecorp');
    expect(findings[0]!.jsonPointer).toBe('name');
  });

  it('detects a short handle (<=6 chars) at word boundaries', () => {
    expect(scanForHandleLeaks({ tags: 'ops-ai-tools' }, ['ai']).length).toBeGreaterThan(0);
  });

  it('short handle does NOT match when embedded mid-word without a boundary', () => {
    expect(scanForHandleLeaks({ name: 'domain-maintain-available' }, ['ai'])).toHaveLength(0);
  });

  it('matching is case-insensitive', () => {
    expect(scanForHandleLeaks({ name: 'ACMECORP branch' }, ['acmecorp'])).toHaveLength(1);
  });

  it('returns an empty array when the handles list is empty', () => {
    expect(scanForHandleLeaks({ name: 'anything' }, [])).toHaveLength(0);
  });

  it('reports dot-path JSON pointer for nested fields', () => {
    const findings = scanForHandleLeaks({ tokens: { color: { alias: 'acmecorp-blue' } } }, ['acmecorp']);
    expect(findings[0]!.jsonPointer).toBe('tokens.color.alias');
  });

  it('reports indexed JSON pointer for array string elements', () => {
    const findings = scanForHandleLeaks({ tags: ['public', 'acmecorp-internal'] }, ['acmecorp']);
    expect(findings[0]!.jsonPointer).toBe('tags[1]');
  });

  it('detects handle in an object key name', () => {
    const findings = scanForHandleLeaks({ tokens: { color: { 'acmecorp-alias': '#fff' } } }, ['acmecorp']);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.jsonPointer).toBe('tokens.color.acmecorp-alias');
  });

  it('non-string scalar values (number, boolean, null) produce no findings', () => {
    expect(scanForHandleLeaks({ count: 42, active: true, ref: null }, ['acmecorp'])).toHaveLength(0);
  });

  it('multiple handles each match independently', () => {
    const findings = scanForHandleLeaks({ a: 'acmecorp-ref', b: 'megacorp-ref' }, ['acmecorp', 'megacorp']);
    const handles = findings.map((f) => f.handle);
    expect(handles).toContain('acmecorp');
    expect(handles).toContain('megacorp');
  });

  it('handle present in both a key name and a string value both produce findings', () => {
    const findings = scanForHandleLeaks({ 'acmecorp-key': 'acmecorp-value' }, ['acmecorp']);
    expect(findings.length).toBeGreaterThanOrEqual(2);
  });

  it('empty object returns no findings', () => {
    expect(scanForHandleLeaks({}, ['acmecorp'])).toHaveLength(0);
  });

  it('correctly reports pointer for a value nested four levels deep', () => {
    const findings = scanForHandleLeaks({ a: { b: { c: { d: 'acmecorp' } } } }, ['acmecorp']);
    expect(findings[0]!.jsonPointer).toBe('a.b.c.d');
  });

  it('detects handle inside an object nested within an array', () => {
    const findings = scanForHandleLeaks({ items: [{ label: 'acmecorp-item' }] }, ['acmecorp']);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0]!.jsonPointer).toBe('items[0].label');
  });

  it('limits the reported value string to 120 characters', () => {
    const long = 'acmecorp-' + 'x'.repeat(200);
    const findings = scanForHandleLeaks({ name: long }, ['acmecorp']);
    expect(findings[0]!.value.length).toBeLessThanOrEqual(120);
  });
});

describe('scrubHandles — unit', () => {
  it('removes a string value containing the handle (key absent in output)', () => {
    const { scrubbed } = scrubHandles({ label: 'acmecorp-brand' }, ['acmecorp']);
    expect((scrubbed as { label: unknown }).label).toBeUndefined();
  });

  it('removes object keys whose names match the handle', () => {
    const { scrubbed } = scrubHandles({ 'acmecorp-token': '#fff', public: '#000' }, ['acmecorp']);
    expect((scrubbed as Record<string, unknown>)['acmecorp-token']).toBeUndefined();
    expect((scrubbed as Record<string, unknown>)['public']).toBe('#000');
  });

  it('filters string array elements containing the handle', () => {
    const { scrubbed } = scrubHandles({ tags: ['public', 'acmecorp-internal', 'open'] }, ['acmecorp']);
    const tags = (scrubbed as { tags: unknown[] }).tags;
    expect(tags).not.toContain('acmecorp-internal');
    expect(tags).toContain('public');
    expect(tags).toContain('open');
  });

  it('records removed paths in removedPaths', () => {
    const { removedPaths } = scrubHandles({ name: 'acmecorp-brand' }, ['acmecorp']);
    expect(removedPaths).toContain('name');
  });

  it('returns the original bundle reference unchanged when handles list is empty', () => {
    const bundle = { name: 'safe' };
    expect(scrubHandles(bundle, []).scrubbed).toBe(bundle);
  });

  it('preserves numeric, boolean, and null scalar values unchanged', () => {
    const bundle = { count: 42, active: true, ref: null };
    const { scrubbed } = scrubHandles(bundle, ['acmecorp']);
    const s = scrubbed as typeof bundle;
    expect(s.count).toBe(42);
    expect(s.active).toBe(true);
    expect(s.ref).toBeNull();
  });

  it('removes a handle from a key nested inside an array of objects', () => {
    const bundle = { items: [{ 'acmecorp-label': 'x', safe: 'y' }] };
    const { scrubbed } = scrubHandles(bundle, ['acmecorp']);
    const item = (scrubbed as { items: Record<string, unknown>[] }).items[0]!;
    expect(item['acmecorp-label']).toBeUndefined();
    expect(item['safe']).toBe('y');
  });

  it('applies multiple handles independently in one pass', () => {
    const bundle = { a: 'acmecorp-val', b: 'megacorp-val', c: 'safe' };
    const { scrubbed } = scrubHandles(bundle, ['acmecorp', 'megacorp']);
    const s = scrubbed as typeof bundle;
    expect(s.a).toBeUndefined();
    expect(s.b).toBeUndefined();
    expect(s.c).toBe('safe');
  });

  it('empty array in the bundle remains an empty array after scrub', () => {
    const { scrubbed } = scrubHandles({ set: [] }, ['acmecorp']);
    expect((scrubbed as { set: unknown[] }).set).toEqual([]);
  });

  it('removes a handle from a string value nested multiple levels deep', () => {
    const { scrubbed } = scrubHandles({ a: { b: { c: 'acmecorp' } } }, ['acmecorp']);
    expect((scrubbed as { a: { b: Record<string, unknown> } }).a.b['c']).toBeUndefined();
  });
});

describe('auditPostScrub — gate detects scrub failures', () => {
  it('returns ok: true when no handles remain in any field', () => {
    expect(auditPostScrub({ name: 'public' }, ['acmecorp']).ok).toBe(true);
  });

  it('returns ok: false with findings when a handle survives in a string value', () => {
    const result = auditPostScrub({ name: 'acmecorp' }, ['acmecorp']);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.findings.length).toBeGreaterThan(0);
      expect(result.findings[0]!.jsonPointer).toBeTruthy();
    }
  });

  it('returns ok: false when a handle survives in a key name', () => {
    expect(auditPostScrub({ 'acmecorp-alias': '#fff' }, ['acmecorp']).ok).toBe(false);
  });

  it('returns ok: true for an empty handles list regardless of content', () => {
    expect(auditPostScrub({ name: 'acmecorp' }, []).ok).toBe(true);
  });

  it('detects a surviving handle in a deeply nested structure', () => {
    expect(auditPostScrub({ tokens: { color: { ref: 'acmecorp-blue' } } }, ['acmecorp']).ok).toBe(false);
  });
});

describe('runSyncPush — push pipeline integration', () => {
  function pushSetup(handles: string[]): { cwd: string; distDir: string; kp: ReturnType<typeof generateKeyPair> } {
    const cwd = tmpDir();
    const distDir = join(cwd, 'dist');
    mkdirSync(join(cwd, '.vbrand'), { recursive: true });
    const kp = generateKeyPair();
    const schema = { ...UMBRELLA_SCHEMA, provenance: { scrubbed_handles: handles } };
    writeFileSync(join(cwd, 'vbrand.schema.json'), JSON.stringify(schema, null, 2) + '\n');
    writeFileSync(
      join(cwd, '.vbrand', 'sync.config.json'),
      JSON.stringify({ umbrellaUrl: `file://${distDir}`, publicKeyBase64: kp.publicKeyBase64, conflictPolicy: 'respect', distributionDir: distDir }, null, 2) + '\n',
    );
    return { cwd, distDir, kp };
  }

  it('succeeds and returns a valid sha256 digest with written file paths', async () => {
    const { cwd, distDir, kp } = pushSetup(['unused-handle']);
    const result = await runSyncPush({ cwd, outDir: distDir, privateKeyBase64: kp.privateKeyBase64 });
    expect(result.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(result.files.length).toBeGreaterThan(0);
  });

  it('strips the provenance block from the distributed bundle', async () => {
    const { cwd, distDir, kp } = pushSetup(['internal-secret']);
    const result = await runSyncPush({ cwd, outDir: distDir, privateKeyBase64: kp.privateKeyBase64 });
    const bundle = JSON.parse(readFileSync(join(distDir, 'by-digest', `${result.digest}.json`), 'utf-8')) as Record<string, unknown>;
    expect(bundle['provenance']).toBeUndefined();
  });

  it('records a push entry in sync.log.jsonl', async () => {
    const { cwd, distDir, kp } = pushSetup([]);
    await runSyncPush({ cwd, outDir: distDir, privateKeyBase64: kp.privateKeyBase64 });
    expect(readLog(syncLogPath(cwd)).some((e) => e.op === 'push')).toBe(true);
  });
});

describe('E_HANDLE_LEAK_DOWNSTREAM — sub-site refuses poisoned bundle', () => {
  it('sync pull rejects a bundle that contains a forbidden handle in a token value', async () => {
    const cwd = tmpDir();
    const distDir = join(cwd, 'dist');
    const kp = generateKeyPair();

    const poisonedBundle = {
      ...UMBRELLA_SCHEMA,
      tokens: { color: { primary: '#acmecorp-ref' }, type: {} },
      provenance: { scrubbed_handles: ['acmecorp'] },
    };
    const digest = digestJson(poisonedBundle);
    const head: SyncHead = { digest, publishedAt: new Date().toISOString(), publicKey: kp.publicKeyBase64 };
    const headBytes = Buffer.from(JSON.stringify(head, null, 2) + '\n', 'utf-8');
    writeBundleToDir(distDir, head, signBytes(headBytes, kp.privateKeyBase64), JSON.stringify(poisonedBundle, null, 2) + '\n');

    writeFileSync(join(cwd, 'vbrand.schema.json'), JSON.stringify(UMBRELLA_SCHEMA, null, 2) + '\n');
    await runSyncInit({ cwd, umbrellaUrl: `file://${distDir}` });
    await expect(runSyncPull({ cwd })).rejects.toThrow(/E_HANDLE_LEAK_DOWNSTREAM/);
  });

  it('sync verify flags a handle leak when the current head bundle contains a forbidden handle', async () => {
    const cwd = tmpDir();
    const distDir = join(cwd, 'dist');
    const kp = generateKeyPair();
    const umbrellaUrl = `file://${distDir}`;

    const cleanHead: SyncHead = { digest: digestJson(UMBRELLA_SCHEMA), publishedAt: new Date().toISOString(), publicKey: kp.publicKeyBase64 };
    const cleanHeadBytes = Buffer.from(JSON.stringify(cleanHead, null, 2) + '\n');
    writeBundleToDir(distDir, cleanHead, signBytes(cleanHeadBytes, kp.privateKeyBase64), JSON.stringify(UMBRELLA_SCHEMA, null, 2) + '\n');

    writeFileSync(join(cwd, 'vbrand.schema.json'), JSON.stringify(UMBRELLA_SCHEMA, null, 2) + '\n');
    await runSyncInit({ cwd, umbrellaUrl });
    await runSyncPull({ cwd });

    const poisonedBundle = { ...UMBRELLA_SCHEMA, tokens: { color: { primary: '#acmecorp-ref' }, type: {} }, provenance: { scrubbed_handles: ['acmecorp'] } };
    const poisonHead: SyncHead = { digest: digestJson(poisonedBundle), publishedAt: new Date().toISOString(), publicKey: kp.publicKeyBase64 };
    const poisonHeadBytes = Buffer.from(JSON.stringify(poisonHead, null, 2) + '\n');
    writeBundleToDir(distDir, poisonHead, signBytes(poisonHeadBytes, kp.privateKeyBase64), JSON.stringify(poisonedBundle, null, 2) + '\n');

    const result = await runSyncVerify({ cwd });
    expect(result.handleLeakFindings.length).toBeGreaterThan(0);
    expect(result.valid).toBe(false);
  });
});
