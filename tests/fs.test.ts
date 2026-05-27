// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { copyDir, dirExists, ensureDir, fileExists, walkFiles, writeJson } from '../src/lib/fs.js';

const tmp = () => mkdtempSync(join(tmpdir(), 'vbrand-fs-'));

describe('ensureDir', () => {
  const dirs: string[] = [];
  afterEach(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); dirs.length = 0; });

  it('creates a directory that does not exist', () => {
    const dir = tmp(); dirs.push(dir);
    const target = join(dir, 'new');
    ensureDir(target);
    expect(existsSync(target)).toBe(true);
  });

  it('creates nested directories in one call', () => {
    const dir = tmp(); dirs.push(dir);
    const target = join(dir, 'a', 'b', 'c');
    ensureDir(target);
    expect(existsSync(target)).toBe(true);
  });

  it('is idempotent - does not throw if directory already exists', () => {
    const dir = tmp(); dirs.push(dir);
    ensureDir(dir);
    expect(() => ensureDir(dir)).not.toThrow();
  });
});

describe('writeJson', () => {
  const dirs: string[] = [];
  afterEach(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); dirs.length = 0; });

  it('creates the file at the specified path', () => {
    const dir = tmp(); dirs.push(dir);
    writeJson(join(dir, 'out.json'), { key: 'value' });
    expect(existsSync(join(dir, 'out.json'))).toBe(true);
  });

  it('output is valid JSON parseable back to the original value', () => {
    const dir = tmp(); dirs.push(dir);
    const data = { a: 1, b: 'hello', c: [true, false] };
    writeJson(join(dir, 'data.json'), data);
    const parsed = JSON.parse(readFileSync(join(dir, 'data.json'), 'utf-8')) as typeof data;
    expect(parsed).toEqual(data);
  });

  it('appends a trailing newline', () => {
    const dir = tmp(); dirs.push(dir);
    writeJson(join(dir, 'nl.json'), {});
    const content = readFileSync(join(dir, 'nl.json'), 'utf-8');
    expect(content.endsWith('\n')).toBe(true);
  });

  it('creates parent directories if they do not exist', () => {
    const dir = tmp(); dirs.push(dir);
    writeJson(join(dir, 'nested', 'deep', 'out.json'), { ok: true });
    expect(existsSync(join(dir, 'nested', 'deep', 'out.json'))).toBe(true);
  });
});

describe('copyDir', () => {
  const dirs: string[] = [];
  afterEach(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); dirs.length = 0; });

  it('copies all files from source to destination', () => {
    const dir = tmp(); dirs.push(dir);
    const src = join(dir, 'src');
    const dest = join(dir, 'dest');
    ensureDir(src);
    writeFileSync(join(src, 'a.txt'), 'a', 'utf-8');
    writeFileSync(join(src, 'b.txt'), 'b', 'utf-8');

    copyDir(src, dest);

    expect(existsSync(join(dest, 'a.txt'))).toBe(true);
    expect(existsSync(join(dest, 'b.txt'))).toBe(true);
  });

  it('copies nested directory structure', () => {
    const dir = tmp(); dirs.push(dir);
    const src = join(dir, 'src');
    ensureDir(join(src, 'sub'));
    writeFileSync(join(src, 'root.txt'), 'root', 'utf-8');
    writeFileSync(join(src, 'sub', 'child.txt'), 'child', 'utf-8');

    copyDir(src, join(dir, 'dest'));

    expect(existsSync(join(dir, 'dest', 'root.txt'))).toBe(true);
    expect(existsSync(join(dir, 'dest', 'sub', 'child.txt'))).toBe(true);
  });

  it('applies rename map to file names', () => {
    const dir = tmp(); dirs.push(dir);
    const src = join(dir, 'src');
    ensureDir(src);
    writeFileSync(join(src, '_gitignore'), 'node_modules/', 'utf-8');

    copyDir(src, join(dir, 'dest'), { _gitignore: '.gitignore' });

    expect(existsSync(join(dir, 'dest', '.gitignore'))).toBe(true);
    expect(existsSync(join(dir, 'dest', '_gitignore'))).toBe(false);
  });
});

describe('walkFiles', () => {
  const dirs: string[] = [];
  afterEach(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); dirs.length = 0; });

  it('returns all files in a flat directory', () => {
    const dir = tmp(); dirs.push(dir);
    writeFileSync(join(dir, 'a.txt'), '', 'utf-8');
    writeFileSync(join(dir, 'b.txt'), '', 'utf-8');
    const files = walkFiles(dir);
    expect(files.length).toBe(2);
  });

  it('returns files recursively from nested directories', () => {
    const dir = tmp(); dirs.push(dir);
    ensureDir(join(dir, 'sub'));
    writeFileSync(join(dir, 'root.txt'), '', 'utf-8');
    writeFileSync(join(dir, 'sub', 'child.txt'), '', 'utf-8');
    const files = walkFiles(dir);
    expect(files.length).toBe(2);
  });

  it('result is sorted', () => {
    const dir = tmp(); dirs.push(dir);
    writeFileSync(join(dir, 'z.txt'), '', 'utf-8');
    writeFileSync(join(dir, 'a.txt'), '', 'utf-8');
    writeFileSync(join(dir, 'm.txt'), '', 'utf-8');
    const files = walkFiles(dir);
    expect(files).toEqual([...files].sort());
  });

  it('returns an empty array for an empty directory', () => {
    const dir = tmp(); dirs.push(dir);
    expect(walkFiles(dir)).toHaveLength(0);
  });
});

describe('dirExists and fileExists', () => {
  const dirs: string[] = [];
  afterEach(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); dirs.length = 0; });

  it('dirExists returns true for an existing directory', () => {
    const dir = tmp(); dirs.push(dir);
    expect(dirExists(dir)).toBe(true);
  });

  it('dirExists returns false for a non-existent path', () => {
    expect(dirExists('/nonexistent/path/xyz')).toBe(false);
  });

  it('dirExists returns false for a file path', () => {
    const dir = tmp(); dirs.push(dir);
    const file = join(dir, 'f.txt');
    writeFileSync(file, '', 'utf-8');
    expect(dirExists(file)).toBe(false);
  });

  it('fileExists returns true for an existing file', () => {
    const dir = tmp(); dirs.push(dir);
    const file = join(dir, 'f.txt');
    writeFileSync(file, '', 'utf-8');
    expect(fileExists(file)).toBe(true);
  });

  it('fileExists returns false for a non-existent path', () => {
    expect(fileExists('/nonexistent/file.txt')).toBe(false);
  });

  it('fileExists returns false for a directory path', () => {
    const dir = tmp(); dirs.push(dir);
    expect(fileExists(dir)).toBe(false);
  });
});
