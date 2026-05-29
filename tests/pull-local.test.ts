// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { loadFromLocal } from '../src/lib/pull/from-local.js';

const dirs: string[] = [];
afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });

function tempFile(data: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), 'vbrand-local-'));
  dirs.push(dir);
  const p = join(dir, 'test.json');
  writeFileSync(p, JSON.stringify(data), 'utf-8');
  return p;
}

const FULL_SCHEMA = {
  name: 'local-brand',
  voice: { canonical: 'Local brand.', repoDescription: 'Local.' },
  assets: {
    favicon: { source: 'logo.png', sizes: [32] },
    og: { dimensions: [1200, 630] },
    icons: { source: 'icons/', set: [] },
  },
  tokens: { color: { primary: '#112233' }, type: {} },
};

const PARTIAL_SCHEMA = {
  name: 'partial-brand',
  voice: { canonical: 'Partial.' },
  tokens: { color: { primary: '#aabbcc' } },
};

describe('loadFromLocal - error contracts', () => {
  it('throws when file does not exist', () => {
    expect(() => loadFromLocal('/does/not/exist/schema.json')).toThrow(/Cannot read local schema/);
  });

  it('error message includes the file path', () => {
    try {
      loadFromLocal('/no/such/file.json');
    } catch (err) {
      expect((err as Error).message).toContain('/no/such/file.json');
    }
  });

  it('throws on malformed JSON', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vbrand-local-'));
    dirs.push(dir);
    const p = join(dir, 'bad.json');
    writeFileSync(p, 'not { json }', 'utf-8');
    expect(() => loadFromLocal(p)).toThrow(/Cannot read local schema/);
  });
});

describe('loadFromLocal - returns CandidateDoc', () => {
  it('produces $candidate: true discriminant', () => {
    const p = tempFile(FULL_SCHEMA);
    const doc = loadFromLocal(p);
    expect(doc.$candidate).toBe(true);
  });

  it('extracts name with high confidence from full schema', () => {
    const p = tempFile(FULL_SCHEMA);
    const doc = loadFromLocal(p);
    expect(doc.fields.name.value).toBe('local-brand');
    expect(doc.fields.name.confidence).toBe('high');
  });

  it('preserves token colors exactly as written', () => {
    const p = tempFile(FULL_SCHEMA);
    const doc = loadFromLocal(p);
    expect(doc.fields.colors.value?.['primary']).toBe('#112233');
    expect(doc.fields.colors.confidence).toBe('high');
  });

  it('extracts favicon from full schema with high confidence', () => {
    const p = tempFile(FULL_SCHEMA);
    const doc = loadFromLocal(p);
    expect(doc.fields.favicon.confidence).toBe('high');
    expect(doc.fields.favicon.value?.source).toBe('logo.png');
  });

  it('is deterministic across repeated calls', () => {
    const p = tempFile(FULL_SCHEMA);
    const r1 = loadFromLocal(p);
    const r2 = loadFromLocal(p);
    expect(r1.fields.name.value).toBe(r2.fields.name.value);
    expect(r1.fields.colors.value).toEqual(r2.fields.colors.value);
  });
});

describe('loadFromLocal - partial input (Defect 2 / acceptance)', () => {
  it('accepts partial input without throwing', () => {
    const p = tempFile(PARTIAL_SCHEMA);
    expect(() => loadFromLocal(p)).not.toThrow();
  });

  it('missing fields land with confidence: none', () => {
    const p = tempFile(PARTIAL_SCHEMA);
    const doc = loadFromLocal(p);
    expect(doc.fields.favicon.confidence).toBe('none');
    expect(doc.fields.favicon.value).toBeNull();
  });

  it('missing tokens.type lands with confidence: none', () => {
    const p = tempFile({ name: 'x', tokens: { color: { primary: '#abc' } } });
    const doc = loadFromLocal(p);
    expect(doc.fields.typeTokens.confidence).toBe('none');
  });

  it('present fields from partial input have confidence: high', () => {
    const p = tempFile(PARTIAL_SCHEMA);
    const doc = loadFromLocal(p);
    expect(doc.fields.name.confidence).toBe('high');
    expect(doc.fields.colors.confidence).toBe('high');
  });

  it('completely empty object produces all-none confidence fields', () => {
    const p = tempFile({});
    const doc = loadFromLocal(p);
    expect(doc.fields.name.confidence).toBe('none');
    expect(doc.fields.colors.confidence).toBe('none');
    expect(doc.fields.favicon.confidence).toBe('none');
  });

  it('passes through a pre-existing CandidateDoc unchanged', () => {
    const existing = {
      $candidate: true,
      slug: 'test-slug',
      sourceUri: 'local:test',
      fields: {
        name: { value: 'Test', confidence: 'high', source: 'local-field' },
        voiceCanonical: { value: null, confidence: 'none', reason: 'absent-in-source' },
        voiceDescription: { value: null, confidence: 'none', reason: 'absent-in-source' },
        colors: { value: null, confidence: 'none', reason: 'absent-in-source' },
        typeTokens: { value: null, confidence: 'none', reason: 'absent-in-source' },
        favicon: { value: null, confidence: 'none', reason: 'absent-in-source' },
        og: { value: null, confidence: 'none', reason: 'absent-in-source' },
        icons: { value: null, confidence: 'none', reason: 'absent-in-source' },
        marks: { value: null, confidence: 'none', reason: 'absent-in-source' },
        themes: { value: null, confidence: 'none', reason: 'absent-in-source' },
        illustration: { value: null, confidence: 'none', reason: 'absent-in-source' },
        slots: { value: null, confidence: 'none', reason: 'absent-in-source' },
        fusePolicies: { value: null, confidence: 'none', reason: 'absent-in-source' },
      },
      provenance: { pulledAt: new Date().toISOString(), degradations: [], assets: [] },
    };
    const p = tempFile(existing);
    const doc = loadFromLocal(p);
    expect(doc.$candidate).toBe(true);
    expect(doc.fields.name.value).toBe('Test');
  });
});
