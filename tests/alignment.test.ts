// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { describe, expect, it } from 'vitest';
import { compareSchemas } from '../src/lib/audit/alignment.js';

const BASE_SCHEMA = {
  name: 'acme',
  voice: { canonical: 'Base brand.', repoDescription: 'Acme.' },
  assets: {
    favicon: { source: 'logo.png', sizes: [32] },
    og: { dimensions: [1200, 630] as [number, number] },
    icons: { source: 'icons/', set: [] },
  },
  tokens: {
    color: { primary: '#0f172a', accent: '#6366f1' },
    type: {},
  },
};

describe('compareSchemas - no drift', () => {
  it('returns empty array when external is an empty object', () => {
    expect(compareSchemas(BASE_SCHEMA, {})).toEqual([]);
  });

  it('returns empty array when name matches', () => {
    expect(compareSchemas(BASE_SCHEMA, { name: 'acme' })).toEqual([]);
  });

  it('returns empty array when color tokens match exactly', () => {
    expect(
      compareSchemas(BASE_SCHEMA, {
        tokens: { color: { primary: '#0f172a' }, type: {} },
      }),
    ).toEqual([]);
  });

  it('returns empty array when all provided fields match', () => {
    expect(
      compareSchemas(BASE_SCHEMA, {
        name: 'acme',
        tokens: { color: { primary: '#0f172a', accent: '#6366f1' }, type: {} },
      }),
    ).toEqual([]);
  });
});

describe('compareSchemas - name drift', () => {
  it('reports drift when external name differs from schema name', () => {
    const drifts = compareSchemas(BASE_SCHEMA, { name: 'other-brand' });
    expect(drifts).toHaveLength(1);
    expect(drifts[0]!.field).toBe('name');
    expect(drifts[0]!.schemaValue).toBe('acme');
    expect(drifts[0]!.externalValue).toBe('other-brand');
  });
});

describe('compareSchemas - color drift', () => {
  it('reports drift for each mismatched color token', () => {
    const drifts = compareSchemas(BASE_SCHEMA, {
      tokens: { color: { primary: '#ffffff' }, type: {} },
    });
    expect(drifts).toHaveLength(1);
    expect(drifts[0]!.field).toBe('tokens.color.primary');
    expect(drifts[0]!.schemaValue).toBe('#0f172a');
    expect(drifts[0]!.externalValue).toBe('#ffffff');
  });

  it('reports multiple drifts when multiple color tokens differ', () => {
    const drifts = compareSchemas(BASE_SCHEMA, {
      tokens: { color: { primary: '#ffffff', accent: '#000000' }, type: {} },
    });
    expect(drifts).toHaveLength(2);
    const fields = drifts.map((d) => d.field);
    expect(fields).toContain('tokens.color.primary');
    expect(fields).toContain('tokens.color.accent');
  });

  it('ignores extra color keys in external that are not in schema', () => {
    const drifts = compareSchemas(BASE_SCHEMA, {
      tokens: { color: { extra: '#abcdef' }, type: {} },
    });
    expect(drifts).toEqual([]);
  });
});

describe('compareSchemas - 3-char hex normalization', () => {
  it('treats #abc as equivalent to #aabbcc in schema value', () => {
    const schema = { ...BASE_SCHEMA, tokens: { color: { primary: '#aabbcc' }, type: {} } };
    const drifts = compareSchemas(schema, {
      tokens: { color: { primary: '#abc' }, type: {} },
    });
    expect(drifts).toEqual([]);
  });

  it('treats #abc as equivalent to #aabbcc in external value', () => {
    const schema = { ...BASE_SCHEMA, tokens: { color: { primary: '#abc' }, type: {} } };
    const drifts = compareSchemas(schema, {
      tokens: { color: { primary: '#aabbcc' }, type: {} },
    });
    expect(drifts).toEqual([]);
  });

  it('treats both #f0f as equal to #ff00ff', () => {
    const schema = { ...BASE_SCHEMA, tokens: { color: { primary: '#ff00ff' }, type: {} } };
    const drifts = compareSchemas(schema, {
      tokens: { color: { primary: '#f0f' }, type: {} },
    });
    expect(drifts).toEqual([]);
  });

  it('still reports drift for genuinely different 3-char and 6-char values', () => {
    const schema = { ...BASE_SCHEMA, tokens: { color: { primary: '#112233' }, type: {} } };
    const drifts = compareSchemas(schema, {
      tokens: { color: { primary: '#abc' }, type: {} },
    });
    expect(drifts).toHaveLength(1);
  });

  it('normalisation is case-insensitive', () => {
    const schema = { ...BASE_SCHEMA, tokens: { color: { primary: '#AABBCC' }, type: {} } };
    const drifts = compareSchemas(schema, {
      tokens: { color: { primary: '#abc' }, type: {} },
    });
    expect(drifts).toEqual([]);
  });
});

describe('compareSchemas - drift shape', () => {
  it('drift object has field, schemaValue, and externalValue properties', () => {
    const drifts = compareSchemas(BASE_SCHEMA, { name: 'different' });
    expect(drifts[0]).toMatchObject({
      field: expect.any(String),
      schemaValue: expect.any(String),
      externalValue: expect.any(String),
    });
  });
});
