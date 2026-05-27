// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runInit } from '../src/commands/init.js';
import { SCHEMA_FILENAME } from '../src/schema.js';

const tmp = () => mkdtempSync(join(tmpdir(), 'vbrand-init-'));

describe('runInit - scaffolded project structure', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
    dirs.length = 0;
  });

  it('creates the project directory', () => {
    const cwd = tmp(); dirs.push(cwd);
    const result = runInit({ name: 'my-app', cwd });
    expect(existsSync(result.projectDir)).toBe(true);
  });

  it('writes all expected template files', () => {
    const cwd = tmp(); dirs.push(cwd);
    const result = runInit({ name: 'my-app', cwd });
    const expected = [
      'package.json',
      'vite.config.ts',
      'tsconfig.json',
      'index.html',
      'src/main.tsx',
      'src/App.tsx',
      'src/index.css',
      '.gitignore',
      SCHEMA_FILENAME,
    ];
    for (const file of expected) {
      expect(existsSync(join(result.projectDir, file)), `expected ${file}`).toBe(true);
    }
  });

  it('renames _gitignore to .gitignore', () => {
    const cwd = tmp(); dirs.push(cwd);
    const result = runInit({ name: 'rename-test', cwd });
    expect(existsSync(join(result.projectDir, '.gitignore'))).toBe(true);
    expect(existsSync(join(result.projectDir, '_gitignore'))).toBe(false);
  });

  it('copies binary files without corruption (magic bytes preserved)', () => {
    const cwd = tmp(); dirs.push(cwd);
    const result = runInit({ name: 'binary-test', cwd });
    const pngPath = join(result.projectDir, 'src', 'assets', 'logo-placeholder.png');
    expect(existsSync(pngPath)).toBe(true);
    const bytes = readFileSync(pngPath);
    expect(bytes[0]).toBe(0x89);
    expect(bytes[1]).toBe(0x50);
    expect(bytes[2]).toBe(0x4e);
    expect(bytes[3]).toBe(0x47);
  });

  it('returns a non-empty files list', () => {
    const cwd = tmp(); dirs.push(cwd);
    const result = runInit({ name: 'files-test', cwd });
    expect(result.files.length).toBeGreaterThan(0);
  });
});

describe('runInit - name interpolation', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
    dirs.length = 0;
  });

  it('interpolates name into package.json', () => {
    const cwd = tmp(); dirs.push(cwd);
    const result = runInit({ name: 'acme', cwd });
    const pkg = JSON.parse(readFileSync(join(result.projectDir, 'package.json'), 'utf-8')) as { name: string };
    expect(pkg.name).toBe('acme');
  });

  it('interpolates name into brand-os.schema.json', () => {
    const cwd = tmp(); dirs.push(cwd);
    const result = runInit({ name: 'acme', cwd });
    const schema = JSON.parse(readFileSync(join(result.projectDir, SCHEMA_FILENAME), 'utf-8')) as { name: string };
    expect(schema.name).toBe('acme');
  });

  it('interpolates name into index.html title', () => {
    const cwd = tmp(); dirs.push(cwd);
    const result = runInit({ name: 'my-product', cwd });
    const html = readFileSync(join(result.projectDir, 'index.html'), 'utf-8');
    expect(html).toContain('my-product');
  });

  it('wires @booga/vui as a dependency', () => {
    const cwd = tmp(); dirs.push(cwd);
    const result = runInit({ name: 'vui-test', cwd });
    const pkg = JSON.parse(readFileSync(join(result.projectDir, 'package.json'), 'utf-8')) as { dependencies: Record<string, string> };
    expect(pkg.dependencies['@booga/vui']).toBeDefined();
  });
});

describe('runInit - name sanitization', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
    dirs.length = 0;
  });

  it('lowercases and hyphenates spaces', () => {
    const cwd = tmp(); dirs.push(cwd);
    const result = runInit({ name: 'My Cool Brand', cwd });
    expect(result.projectDir).toMatch(/my-cool-brand$/);
  });

  it('strips special characters', () => {
    const cwd = tmp(); dirs.push(cwd);
    const result = runInit({ name: 'My Brand!@#', cwd });
    expect(result.projectDir).toMatch(/my-brand$/);
  });

  it('falls back to my-brand when name contains only special chars', () => {
    const cwd = tmp(); dirs.push(cwd);
    const result = runInit({ name: '!@#$%', cwd });
    expect(result.projectDir).toMatch(/my-brand$/);
  });

  it('falls back to my-brand when no name is provided', () => {
    const cwd = tmp(); dirs.push(cwd);
    const result = runInit({ cwd });
    expect(result.projectDir).toMatch(/my-brand$/);
  });

  it('preserves numbers in name', () => {
    const cwd = tmp(); dirs.push(cwd);
    const result = runInit({ name: 'brand-2026', cwd });
    expect(result.projectDir).toMatch(/brand-2026$/);
  });
});

describe('runInit - error conditions', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
    dirs.length = 0;
  });

  it('throws when destination directory already exists', () => {
    const cwd = tmp(); dirs.push(cwd);
    runInit({ name: 'existing', cwd });
    expect(() => runInit({ name: 'existing', cwd })).toThrow('already exists');
  });

  it('error message includes the conflicting path', () => {
    const cwd = tmp(); dirs.push(cwd);
    runInit({ name: 'conflict', cwd });
    expect(() => runInit({ name: 'conflict', cwd })).toThrow('conflict');
  });
});
