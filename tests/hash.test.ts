import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { diffDirHashes, hashDir, hashFile } from '../src/lib/hash.js';
import { ensureDir } from '../src/lib/fs.js';

const tmp = () => mkdtempSync(join(tmpdir(), 'vbrand-hash-'));
const write = (dir: string, name: string, content: string) =>
  writeFileSync(join(dir, name), content, 'utf-8');

describe('hashFile', () => {
  const dirs: string[] = [];
  afterEach(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); dirs.length = 0; });

  it('returns a 64-character hex string (SHA-256)', () => {
    const dir = tmp(); dirs.push(dir);
    write(dir, 'a.txt', 'hello');
    expect(hashFile(join(dir, 'a.txt'))).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic: same content → same hash', () => {
    const dir = tmp(); dirs.push(dir);
    write(dir, 'a.txt', 'hello');
    write(dir, 'b.txt', 'hello');
    expect(hashFile(join(dir, 'a.txt'))).toBe(hashFile(join(dir, 'b.txt')));
  });

  it('different content → different hash', () => {
    const dir = tmp(); dirs.push(dir);
    write(dir, 'a.txt', 'hello');
    write(dir, 'b.txt', 'world');
    expect(hashFile(join(dir, 'a.txt'))).not.toBe(hashFile(join(dir, 'b.txt')));
  });

  it('any byte change produces a different hash', () => {
    const dir = tmp(); dirs.push(dir);
    writeFileSync(join(dir, 'a.bin'), Buffer.from([0, 1, 2, 3]));
    writeFileSync(join(dir, 'b.bin'), Buffer.from([0, 1, 2, 4]));
    expect(hashFile(join(dir, 'a.bin'))).not.toBe(hashFile(join(dir, 'b.bin')));
  });
});

describe('hashDir', () => {
  const dirs: string[] = [];
  afterEach(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); dirs.length = 0; });

  it('maps relative paths as keys', () => {
    const dir = tmp(); dirs.push(dir);
    write(dir, 'a.txt', 'a');
    write(dir, 'b.txt', 'b');
    const map = hashDir(dir);
    expect(map.has('a.txt')).toBe(true);
    expect(map.has('b.txt')).toBe(true);
  });

  it('keys use forward-slash-like relative paths for nested files', () => {
    const dir = tmp(); dirs.push(dir);
    ensureDir(join(dir, 'sub'));
    write(join(dir, 'sub'), 'c.txt', 'c');
    const map = hashDir(dir);
    const keys = [...map.keys()];
    expect(keys.some((k) => k.includes('c.txt'))).toBe(true);
  });

  it('returns an empty map for an empty directory', () => {
    const dir = tmp(); dirs.push(dir);
    expect(hashDir(dir).size).toBe(0);
  });

  it('values are valid SHA-256 hex strings', () => {
    const dir = tmp(); dirs.push(dir);
    write(dir, 'x.txt', 'data');
    for (const hash of hashDir(dir).values()) {
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});

describe('diffDirHashes', () => {
  it('returns empty array when both maps are identical', () => {
    const m = new Map([['a.txt', 'aaa'], ['b.txt', 'bbb']]);
    expect(diffDirHashes(m, new Map(m))).toHaveLength(0);
  });

  it('returns empty array for two empty maps', () => {
    expect(diffDirHashes(new Map(), new Map())).toHaveLength(0);
  });

  it('reports a file whose hash changed', () => {
    const expected = new Map([['a.txt', 'hash1']]);
    const actual = new Map([['a.txt', 'hash2']]);
    const drifted = diffDirHashes(expected, actual);
    expect(drifted).toContain('a.txt');
  });

  it('reports a file present in expected but missing from actual', () => {
    const expected = new Map([['a.txt', 'hash1'], ['b.txt', 'hash2']]);
    const actual = new Map([['b.txt', 'hash2']]);
    const drifted = diffDirHashes(expected, actual);
    expect(drifted).toContain('a.txt');
    expect(drifted).not.toContain('b.txt');
  });

  it('reports a file present in actual but absent from expected', () => {
    const expected = new Map([['a.txt', 'hash1']]);
    const actual = new Map([['a.txt', 'hash1'], ['extra.txt', 'hashX']]);
    const drifted = diffDirHashes(expected, actual);
    expect(drifted).toContain('extra.txt');
    expect(drifted).not.toContain('a.txt');
  });

  it('reports all drifted entries when multiple files differ', () => {
    const expected = new Map([['a.txt', 'h1'], ['b.txt', 'h2'], ['c.txt', 'h3']]);
    const actual = new Map([['a.txt', 'CHANGED'], ['b.txt', 'h2'], ['c.txt', 'CHANGED']]);
    const drifted = diffDirHashes(expected, actual);
    expect(drifted).toContain('a.txt');
    expect(drifted).toContain('c.txt');
    expect(drifted).not.toContain('b.txt');
  });

  it('result is sorted alphabetically', () => {
    const expected = new Map([['z.txt', 'h1'], ['a.txt', 'h2'], ['m.txt', 'h3']]);
    const actual = new Map([['z.txt', 'X'], ['a.txt', 'X'], ['m.txt', 'X']]);
    const drifted = diffDirHashes(expected, actual);
    expect(drifted).toEqual([...drifted].sort());
  });

  it('result contains no duplicates', () => {
    const expected = new Map([['a.txt', 'h1']]);
    const actual = new Map([['a.txt', 'h2']]);
    const drifted = diffDirHashes(expected, actual);
    expect(drifted.length).toBe(new Set(drifted).size);
  });
});
