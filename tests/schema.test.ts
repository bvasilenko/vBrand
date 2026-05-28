// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { describe, expect, it } from 'vitest';
import { VbrandSchema } from '../src/schema.js';

const VALID_SCHEMA = {
  name: 'test-brand',
  voice: {
    canonical: 'Terse. Technical.',
    repoDescription: 'Test brand schema.',
  },
  assets: {
    favicon: { source: 'logo.png', sizes: [16, 32, 512] },
    og: { source: 'og.png', dimensions: [1200, 630] as [number, number] },
    icons: { source: 'icons/', set: ['menu', 'close'] },
  },
  tokens: {
    color: { primary: '#000000', accent: '#ffffff' },
    type: { sans: 'Inter, sans-serif' },
  },
};

describe('VbrandSchema - valid input', () => {
  it('accepts a fully-populated valid schema', () => {
    expect(VbrandSchema.safeParse(VALID_SCHEMA).success).toBe(true);
  });

  it('accepts empty color and type token maps', () => {
    const result = VbrandSchema.safeParse({
      ...VALID_SCHEMA,
      tokens: { color: {}, type: {} },
    });
    expect(result.success).toBe(true);
  });

  it('accepts an empty icon set', () => {
    const result = VbrandSchema.safeParse({
      ...VALID_SCHEMA,
      assets: { ...VALID_SCHEMA.assets, icons: { source: 'icons/', set: [] } },
    });
    expect(result.success).toBe(true);
  });

  it('round-trip: parse → JSON.stringify → parse yields identical value', () => {
    const first = VbrandSchema.parse(VALID_SCHEMA);
    const second = VbrandSchema.parse(JSON.parse(JSON.stringify(first)));
    expect(second).toEqual(first);
  });
});

describe('VbrandSchema - top-level required fields', () => {
  it.each(['name', 'voice', 'assets', 'tokens'] as const)(
    'rejects when %s is missing',
    (field) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [field]: _, ...rest } = VALID_SCHEMA;
      expect(VbrandSchema.safeParse(rest).success).toBe(false);
    },
  );

  it('rejects unknown top-level keys (strict)', () => {
    expect(VbrandSchema.safeParse({ ...VALID_SCHEMA, extra: 'x' }).success).toBe(false);
  });
});

describe('VbrandSchema - string min-length boundaries', () => {
  it('rejects empty name', () => {
    expect(VbrandSchema.safeParse({ ...VALID_SCHEMA, name: '' }).success).toBe(false);
  });

  it('rejects empty voice.canonical', () => {
    expect(
      VbrandSchema.safeParse({
        ...VALID_SCHEMA,
        voice: { ...VALID_SCHEMA.voice, canonical: '' },
      }).success,
    ).toBe(false);
  });

  it('rejects empty voice.repoDescription', () => {
    expect(
      VbrandSchema.safeParse({
        ...VALID_SCHEMA,
        voice: { ...VALID_SCHEMA.voice, repoDescription: '' },
      }).success,
    ).toBe(false);
  });

  it('rejects empty favicon source path', () => {
    expect(
      VbrandSchema.safeParse({
        ...VALID_SCHEMA,
        assets: {
          ...VALID_SCHEMA.assets,
          favicon: { source: '', sizes: [32] },
        },
      }).success,
    ).toBe(false);
  });

  it('rejects empty string inside icons.set', () => {
    expect(
      VbrandSchema.safeParse({
        ...VALID_SCHEMA,
        assets: {
          ...VALID_SCHEMA.assets,
          icons: { source: 'icons/', set: ['valid', ''] },
        },
      }).success,
    ).toBe(false);
  });
});

describe('VbrandSchema - favicon.sizes constraints', () => {
  it('rejects empty sizes array', () => {
    expect(
      VbrandSchema.safeParse({
        ...VALID_SCHEMA,
        assets: { ...VALID_SCHEMA.assets, favicon: { source: 'logo.png', sizes: [] } },
      }).success,
    ).toBe(false);
  });

  it('rejects zero as a size (must be positive)', () => {
    expect(
      VbrandSchema.safeParse({
        ...VALID_SCHEMA,
        assets: { ...VALID_SCHEMA.assets, favicon: { source: 'logo.png', sizes: [0] } },
      }).success,
    ).toBe(false);
  });

  it('rejects negative size', () => {
    expect(
      VbrandSchema.safeParse({
        ...VALID_SCHEMA,
        assets: { ...VALID_SCHEMA.assets, favicon: { source: 'logo.png', sizes: [-32] } },
      }).success,
    ).toBe(false);
  });

  it('rejects fractional size', () => {
    expect(
      VbrandSchema.safeParse({
        ...VALID_SCHEMA,
        assets: { ...VALID_SCHEMA.assets, favicon: { source: 'logo.png', sizes: [32.5] } },
      }).success,
    ).toBe(false);
  });
});

describe('VbrandSchema - og.dimensions constraints', () => {
  it('rejects zero width', () => {
    expect(
      VbrandSchema.safeParse({
        ...VALID_SCHEMA,
        assets: { ...VALID_SCHEMA.assets, og: { source: 'og.png', dimensions: [0, 630] } },
      }).success,
    ).toBe(false);
  });

  it('rejects negative height', () => {
    expect(
      VbrandSchema.safeParse({
        ...VALID_SCHEMA,
        assets: { ...VALID_SCHEMA.assets, og: { source: 'og.png', dimensions: [1200, -1] } },
      }).success,
    ).toBe(false);
  });

  it('rejects single-element tuple', () => {
    expect(
      VbrandSchema.safeParse({
        ...VALID_SCHEMA,
        assets: { ...VALID_SCHEMA.assets, og: { source: 'og.png', dimensions: [1200] } },
      }).success,
    ).toBe(false);
  });

  it('rejects three-element tuple', () => {
    expect(
      VbrandSchema.safeParse({
        ...VALID_SCHEMA,
        assets: { ...VALID_SCHEMA.assets, og: { source: 'og.png', dimensions: [1200, 630, 50] } },
      }).success,
    ).toBe(false);
  });
});

describe('VbrandSchema - nested strict mode', () => {
  it('rejects unknown key inside voice', () => {
    expect(
      VbrandSchema.safeParse({
        ...VALID_SCHEMA,
        voice: { ...VALID_SCHEMA.voice, extra: 'x' },
      }).success,
    ).toBe(false);
  });

  it('rejects unknown key inside assets.favicon', () => {
    expect(
      VbrandSchema.safeParse({
        ...VALID_SCHEMA,
        assets: {
          ...VALID_SCHEMA.assets,
          favicon: { ...VALID_SCHEMA.assets.favicon, extra: 'x' },
        },
      }).success,
    ).toBe(false);
  });

  it('rejects unknown key inside tokens', () => {
    expect(
      VbrandSchema.safeParse({
        ...VALID_SCHEMA,
        tokens: { ...VALID_SCHEMA.tokens, extra: {} },
      }).success,
    ).toBe(false);
  });
});
