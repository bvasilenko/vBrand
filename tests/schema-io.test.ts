// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { loadSchema, writeSchema } from '../src/lib/schema-io.js';

const dirs: string[] = [];
afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });

const VALID_SCHEMA = {
  name: 'acme',
  voice: { canonical: 'Minimal brand.', repoDescription: 'Acme.' },
  assets: {
    favicon: { source: 'logo.png', sizes: [32] },
    og: { dimensions: [1200, 630] as [number, number] },
    icons: { source: 'icons/', set: [] },
  },
  tokens: { color: { primary: '#000' }, type: {} },
};

describe('loadSchema - error contracts', () => {
  it('throws a descriptive error when file does not exist', () => {
    expect(() => loadSchema('/nonexistent/path/vbrand.schema.json')).toThrow(
      /Schema not found or unreadable/,
    );
  });

  it('throws a descriptive error when file contains invalid JSON', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vbrand-io-'));
    dirs.push(dir);
    const p = join(dir, 'bad.json');
    writeFileSync(p, '{ not valid json }', 'utf-8');
    expect(() => loadSchema(p)).toThrow(/Schema not found or unreadable/);
  });

  it('throws a ZodError when JSON is valid but schema validation fails', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vbrand-io-'));
    dirs.push(dir);
    const p = join(dir, 'invalid.json');
    writeFileSync(p, JSON.stringify({ name: '', voice: {} }), 'utf-8');
    expect(() => loadSchema(p)).toThrow();
  });

  it('error message includes the file path', () => {
    const target = '/nonexistent/vbrand.schema.json';
    try {
      loadSchema(target);
    } catch (err) {
      expect((err as Error).message).toContain(target);
    }
  });
});

describe('loadSchema - success', () => {
  it('parses and returns a valid schema', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vbrand-io-'));
    dirs.push(dir);
    const p = join(dir, 'vbrand.schema.json');
    writeFileSync(p, JSON.stringify(VALID_SCHEMA), 'utf-8');
    const result = loadSchema(p);
    expect(result.name).toBe('acme');
    expect(result.tokens.color['primary']).toBe('#000');
  });
});

describe('writeSchema', () => {
  it('writes schema as indented JSON with a trailing newline', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vbrand-io-'));
    dirs.push(dir);
    const p = join(dir, 'out.json');
    writeSchema(VALID_SCHEMA, p);
    const content = readFileSync(p, 'utf-8');
    expect(content.endsWith('\n')).toBe(true);
    expect(() => JSON.parse(content)).not.toThrow();
  });

  it('creates parent directories if they do not exist', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vbrand-io-'));
    dirs.push(dir);
    const nested = join(dir, 'a', 'b', 'c', 'out.json');
    expect(() => writeSchema(VALID_SCHEMA, nested)).not.toThrow();
    const content = readFileSync(nested, 'utf-8');
    expect(JSON.parse(content).name).toBe('acme');
  });

  it('round-trips through loadSchema without data loss', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vbrand-io-'));
    dirs.push(dir);
    const p = join(dir, 'round-trip.json');
    writeSchema(VALID_SCHEMA, p);
    const loaded = loadSchema(p);
    expect(loaded).toEqual(expect.objectContaining({ name: 'acme' }));
  });

  it('overwrites an existing file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vbrand-io-'));
    dirs.push(dir);
    const p = join(dir, 'overwrite.json');
    writeSchema(VALID_SCHEMA, p);
    writeSchema({ ...VALID_SCHEMA, name: 'updated' }, p);
    const loaded = loadSchema(p);
    expect(loaded.name).toBe('updated');
  });
});
