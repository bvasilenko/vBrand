// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { describe, expect, it } from 'vitest';
import { VbrandSchema } from '../src/schema.js';

const MINIMAL_SCHEMA = {
  name: 'acme',
  voice: { canonical: 'Minimal brand.', repoDescription: 'Acme.' },
  assets: {
    favicon: { source: 'logo.png', sizes: [32] },
    og: { dimensions: [1200, 630] as [number, number] },
    icons: { source: 'icons/', set: [] },
  },
  tokens: { color: { primary: '#000' }, type: {} },
};

const MAXIMAL_SCHEMA = {
  ...MINIMAL_SCHEMA,
  name: 'maximal-brand',
  voice: { canonical: 'Terse. Technical.', repoDescription: 'Maximal fixture.' },
  assets: {
    ...MINIMAL_SCHEMA.assets,
    favicon: { source: 'logo.png', sizes: [16, 32, 180, 512] },
    og: { source: 'og-source.png', dimensions: [1200, 630] as [number, number] },
    icons: { source: 'icons/', set: ['menu', 'close'] },
  },
  tokens: {
    color: { primary: '#0f172a', accent: '#6366f1', background: '#ffffff' },
    type: { sans: 'Inter, sans-serif', mono: 'JetBrains Mono, monospace' },
  },
  sources: ['https://example.com'],
  marks: {
    logoMinWidth: 120,
    logoAspectRatio: '4:1',
    safeZoneRatio: 0.5,
    variants: [{ name: 'horizontal', source: 'logo-h.svg', usage: 'header' }],
  },
  themes: {
    modes: ['light', 'dark'] as const,
    registry: {
      light: { primary: '#0f172a' },
      dark: { primary: '#f8fafc' },
    },
  },
  illustration: {
    style: 'flat' as const,
    palette: ['#0f172a', '#6366f1'],
    assetDir: 'illustrations/',
  },
  slots: {
    tagline: {
      description: 'Short tagline',
      placeholder: 'Your tagline here',
      value: 'Ship fast.',
      contentType: 'tagline' as const,
    },
  },
  fusePolicies: {
    'tokens.color': 'array-replace' as const,
    sources: 'array-union' as const,
  },
};

describe('VbrandSchema - minimal fixture', () => {
  it('round-trip parses minimal schema', () => {
    const parsed = VbrandSchema.parse(MINIMAL_SCHEMA);
    const reparsed = VbrandSchema.parse(JSON.parse(JSON.stringify(parsed)));
    expect(reparsed).toEqual(parsed);
  });

  it('og.source is optional in minimal schema', () => {
    expect(VbrandSchema.safeParse(MINIMAL_SCHEMA).success).toBe(true);
  });
});

describe('VbrandSchema - maximal fixture', () => {
  it('round-trip parses maximal schema without loss', () => {
    const parsed = VbrandSchema.parse(MAXIMAL_SCHEMA);
    const reparsed = VbrandSchema.parse(JSON.parse(JSON.stringify(parsed)));
    expect(reparsed).toEqual(parsed);
  });

  it('preserves all top-level optional keys', () => {
    const parsed = VbrandSchema.parse(MAXIMAL_SCHEMA);
    expect(parsed.sources).toBeDefined();
    expect(parsed.marks).toBeDefined();
    expect(parsed.themes).toBeDefined();
    expect(parsed.illustration).toBeDefined();
    expect(parsed.slots).toBeDefined();
    expect(parsed.fusePolicies).toBeDefined();
  });
});

describe('VbrandSchema - required fields', () => {
  it.each(['name', 'voice', 'assets', 'tokens'] as const)(
    'rejects when %s is missing',
    (field) => {
      const { [field]: _unused, ...rest } = MINIMAL_SCHEMA; void _unused;
      expect(VbrandSchema.safeParse(rest).success).toBe(false);
    },
  );

  it('rejects unknown top-level keys', () => {
    expect(VbrandSchema.safeParse({ ...MINIMAL_SCHEMA, unknown: 'x' }).success).toBe(false);
  });

  it('rejects empty name', () => {
    expect(VbrandSchema.safeParse({ ...MINIMAL_SCHEMA, name: '' }).success).toBe(false);
  });
});

describe('VbrandSchema - marks', () => {
  it('accepts marks with only optional fields', () => {
    expect(VbrandSchema.safeParse({ ...MINIMAL_SCHEMA, marks: {} }).success).toBe(true);
  });

  it('rejects unknown key inside marks', () => {
    expect(
      VbrandSchema.safeParse({ ...MINIMAL_SCHEMA, marks: { unknown: 'x' } }).success,
    ).toBe(false);
  });
});

describe('VbrandSchema - themes', () => {
  it('accepts valid theme modes', () => {
    const result = VbrandSchema.safeParse({
      ...MINIMAL_SCHEMA,
      themes: { modes: ['light', 'dark'] },
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid theme mode', () => {
    const result = VbrandSchema.safeParse({
      ...MINIMAL_SCHEMA,
      themes: { modes: ['invalid'] },
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty modes array', () => {
    const result = VbrandSchema.safeParse({
      ...MINIMAL_SCHEMA,
      themes: { modes: [] },
    });
    expect(result.success).toBe(false);
  });
});

describe('VbrandSchema - slots', () => {
  it('accepts slot with valid contentType', () => {
    const result = VbrandSchema.safeParse({
      ...MINIMAL_SCHEMA,
      slots: { tagline: { contentType: 'tagline', value: 'Ship fast.' } },
    });
    expect(result.success).toBe(true);
  });

  it('rejects slot with invalid contentType', () => {
    const result = VbrandSchema.safeParse({
      ...MINIMAL_SCHEMA,
      slots: { tagline: { contentType: 'invalid' } },
    });
    expect(result.success).toBe(false);
  });
});

describe('VbrandSchema - fusePolicies', () => {
  it('accepts valid fuse policy hints', () => {
    const result = VbrandSchema.safeParse({
      ...MINIMAL_SCHEMA,
      fusePolicies: { 'tokens.color': 'array-union', sources: 'null-delete' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid fuse policy hint', () => {
    const result = VbrandSchema.safeParse({
      ...MINIMAL_SCHEMA,
      fusePolicies: { 'tokens.color': 'invalid-hint' },
    });
    expect(result.success).toBe(false);
  });
});
