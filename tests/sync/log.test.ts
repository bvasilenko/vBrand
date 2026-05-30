// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { appendLogEntry, readLog, readLogSince } from '../../src/lib/sync/log.js';
import type { SyncLogEntry } from '../../src/lib/sync/types.js';

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

function tmpDir(): string {
  const d = mkdtempSync(join(tmpdir(), 'vbrand-log-'));
  dirs.push(d);
  return d;
}

const ENTRY_A: SyncLogEntry = { at: '2026-01-01T00:00:00.000Z', op: 'push', digest: 'aaaa' };
const ENTRY_B: SyncLogEntry = {
  at: '2026-01-02T00:00:00.000Z',
  op: 'pull',
  digest: 'bbbb',
  fieldsAdopted: 2,
  fieldsHeld: ['tokens.color.primary'],
  observedValues: { 'tokens.color.primary': '#1e40af' },
};
const ENTRY_C: SyncLogEntry = { at: '2026-01-03T00:00:00.000Z', op: 'verify', digest: 'cccc' };

describe('appendLogEntry + readLog', () => {
  it('creates the log file when it does not exist', () => {
    const path = join(tmpDir(), 'sync.log.jsonl');
    expect(existsSync(path)).toBe(false);
    appendLogEntry(path, ENTRY_A);
    expect(existsSync(path)).toBe(true);
  });

  it('each entry occupies exactly one JSONL line', () => {
    const path = join(tmpDir(), 'sync.log.jsonl');
    appendLogEntry(path, ENTRY_A);
    appendLogEntry(path, ENTRY_B);
    const lines = readFileSync(path, 'utf-8').split('\n').filter(Boolean);
    expect(lines).toHaveLength(2);
    expect(() => JSON.parse(lines[0]!)).not.toThrow();
    expect(() => JSON.parse(lines[1]!)).not.toThrow();
  });

  it('readLog returns an empty array when the file does not exist', () => {
    expect(readLog(join(tmpDir(), 'nonexistent.jsonl'))).toEqual([]);
  });

  it('readLog returns an empty array for a file containing only whitespace', () => {
    const path = join(tmpDir(), 'sync.log.jsonl');
    writeFileSync(path, '\n\n', 'utf-8');
    expect(readLog(path)).toEqual([]);
  });

  it('appended entries are returned in insertion order', () => {
    const path = join(tmpDir(), 'sync.log.jsonl');
    appendLogEntry(path, ENTRY_A);
    appendLogEntry(path, ENTRY_B);
    appendLogEntry(path, ENTRY_C);
    const entries = readLog(path);
    expect(entries[0]!.digest).toBe('aaaa');
    expect(entries[1]!.digest).toBe('bbbb');
    expect(entries[2]!.digest).toBe('cccc');
  });

  it('all SyncLogEntry fields round-trip faithfully through JSONL serialisation', () => {
    const path = join(tmpDir(), 'sync.log.jsonl');
    appendLogEntry(path, ENTRY_B);
    const [entry] = readLog(path);
    expect(entry).toEqual(ENTRY_B);
  });

  it('entries with different op types coexist in the same log', () => {
    const path = join(tmpDir(), 'sync.log.jsonl');
    appendLogEntry(path, ENTRY_A);
    appendLogEntry(path, ENTRY_B);
    appendLogEntry(path, ENTRY_C);
    const ops = readLog(path).map((e) => e.op);
    expect(ops).toContain('push');
    expect(ops).toContain('pull');
    expect(ops).toContain('verify');
  });
});

describe('readLogSince', () => {
  it('returns all entries after the last entry whose digest matches', () => {
    const path = join(tmpDir(), 'sync.log.jsonl');
    appendLogEntry(path, ENTRY_A);
    appendLogEntry(path, ENTRY_B);
    appendLogEntry(path, ENTRY_C);
    const since = readLogSince(path, 'bbbb');
    expect(since).toHaveLength(1);
    expect(since[0]!.digest).toBe('cccc');
  });

  it('returns all entries when the digest is not found in the log', () => {
    const path = join(tmpDir(), 'sync.log.jsonl');
    appendLogEntry(path, ENTRY_A);
    appendLogEntry(path, ENTRY_B);
    expect(readLogSince(path, 'zzzz')).toHaveLength(2);
  });

  it('returns an empty array when the matching digest is the last entry', () => {
    const path = join(tmpDir(), 'sync.log.jsonl');
    appendLogEntry(path, ENTRY_A);
    appendLogEntry(path, ENTRY_B);
    expect(readLogSince(path, 'bbbb')).toHaveLength(0);
  });

  it('resolves to the last occurrence when the same digest appears multiple times', () => {
    const path = join(tmpDir(), 'sync.log.jsonl');
    const dup: SyncLogEntry = { at: '2026-01-04T00:00:00.000Z', op: 'pull', digest: 'aaaa' };
    appendLogEntry(path, ENTRY_A);
    appendLogEntry(path, ENTRY_B);
    appendLogEntry(path, dup);
    appendLogEntry(path, ENTRY_C);
    const since = readLogSince(path, 'aaaa');
    expect(since).toHaveLength(1);
    expect(since[0]!.digest).toBe('cccc');
  });
});
