// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { describe, it, expect } from 'vitest';
import type { VbrandType } from '@booga/vbrand/adapters/browser';
import { applyDemoOverlay, type BrandMeta } from '../src/brand-loader.js';
import type { BrandParams } from '../src/router.js';

const BASE_ASSETS = {
  favicon: { source: 'https://example.com/favicon.ico', sizes: [32] },
  og: { dimensions: [1200, 630] },
  icons: { source: 'https://example.com/icon.svg', set: [] },
} as const;

const BRAND_WITH_COLORS: VbrandType = {
  name: 'TestBrand',
  voice: { canonical: 'The test brand.', repoDescription: 'A test.' },
  assets: BASE_ASSETS,
  tokens: { color: { primary: '#ff0000', secondary: '#0000ff' }, type: { body: 'Inter' } },
  sources: ['test:source'],
};

const BRAND_NO_COLORS: VbrandType = {
  ...BRAND_WITH_COLORS,
  tokens: { color: {}, type: { body: 'Inter' } },
};

const BRAND_NO_TOKENS: VbrandType = {
  ...BRAND_WITH_COLORS,
  tokens: { color: {}, type: {} },
};

const GITHUB_PARAMS: BrandParams = { type: 'github', owner: 'acme', repo: 'widget' };
const FIXTURE_STRIPE_PARAMS: BrandParams = { type: 'fixture', handle: 'stripe' };
const FIXTURE_VERCEL_PARAMS: BrandParams = { type: 'fixture', handle: 'vercel' };
const URL_PARAMS: BrandParams = { type: 'url', url: 'https://acme.com' };
const NPM_PARAMS: BrandParams = { type: 'npm', pkg: '@acme/widget' };
const JSON_PARAMS: BrandParams = { type: 'json', payload: {} };

const ALL_NON_GITHUB_PARAMS: ReadonlyArray<[string, BrandParams]> = [
  ['fixture:vercel',     FIXTURE_VERCEL_PARAMS],
  ['fixture:stripe',     FIXTURE_STRIPE_PARAMS],
  ['url',                URL_PARAMS],
  ['npm',                NPM_PARAMS],
  ['json',               JSON_PARAMS],
];

describe('applyDemoOverlay: BrandMeta defaults when brand is fully populated', () => {
  it('colorFallbackActive is false when brand has color tokens', () => {
    const { meta } = applyDemoOverlay(BRAND_WITH_COLORS, GITHUB_PARAMS);
    expect(meta.colorFallbackActive).toBe(false);
  });

  it('githubColorFallback is false when brand has color tokens regardless of source type', () => {
    const { meta } = applyDemoOverlay(BRAND_WITH_COLORS, GITHUB_PARAMS);
    expect(meta.githubColorFallback).toBe(false);
  });

  it('faviconBundled is false for non-stripe fixture with a populated brand', () => {
    const { meta } = applyDemoOverlay(BRAND_WITH_COLORS, FIXTURE_VERCEL_PARAMS);
    expect(meta.faviconBundled).toBe(false);
  });

  it('returned brand is the original brand when no overlay conditions apply', () => {
    const { brand } = applyDemoOverlay(BRAND_WITH_COLORS, URL_PARAMS);
    expect(brand.tokens.color).toEqual(BRAND_WITH_COLORS.tokens.color);
  });

  it('all three BrandMeta flags start as false for a brand with color tokens', () => {
    const { meta } = applyDemoOverlay(BRAND_WITH_COLORS, URL_PARAMS);
    const expected: BrandMeta = { colorFallbackActive: false, faviconBundled: false, githubColorFallback: false };
    expect(meta).toEqual(expected);
  });
});

describe('applyDemoOverlay: colorFallbackActive signal', () => {
  it('is true when brand has no color tokens', () => {
    const { meta } = applyDemoOverlay(BRAND_NO_COLORS, URL_PARAMS);
    expect(meta.colorFallbackActive).toBe(true);
  });

  it.each(ALL_NON_GITHUB_PARAMS)(
    'is true for %s source when color tokens are empty',
    (_label, params) => {
      const { meta } = applyDemoOverlay(BRAND_NO_COLORS, params);
      expect(meta.colorFallbackActive).toBe(true);
    },
  );

  it('is true for github source when color tokens are empty', () => {
    const { meta } = applyDemoOverlay(BRAND_NO_COLORS, GITHUB_PARAMS);
    expect(meta.colorFallbackActive).toBe(true);
  });

  it('is false when brand has at least one color token', () => {
    const brand = { ...BRAND_WITH_COLORS, tokens: { ...BRAND_WITH_COLORS.tokens, color: { primary: '#abcdef' } } };
    const { meta } = applyDemoOverlay(brand, URL_PARAMS);
    expect(meta.colorFallbackActive).toBe(false);
  });

  it('applying the fallback palette replaces the empty color token map', () => {
    const { brand } = applyDemoOverlay(BRAND_NO_COLORS, URL_PARAMS);
    expect(Object.keys(brand.tokens.color).length).toBeGreaterThan(0);
  });

  it('fallback palette includes a primary color token', () => {
    const { brand } = applyDemoOverlay(BRAND_NO_COLORS, URL_PARAMS);
    expect(brand.tokens.color).toHaveProperty('primary');
  });

  it('fallback palette primary value is a non-empty string', () => {
    const { brand } = applyDemoOverlay(BRAND_NO_COLORS, URL_PARAMS);
    expect(typeof brand.tokens.color['primary']).toBe('string');
    expect((brand.tokens.color['primary'] as string).length).toBeGreaterThan(0);
  });

  it('original color tokens are preserved unchanged when brand has colors', () => {
    const { brand } = applyDemoOverlay(BRAND_WITH_COLORS, URL_PARAMS);
    expect(brand.tokens.color).toEqual(BRAND_WITH_COLORS.tokens.color);
  });

  it('type tokens are preserved unchanged regardless of color fallback', () => {
    const { brand } = applyDemoOverlay(BRAND_NO_COLORS, URL_PARAMS);
    expect(brand.tokens.type).toEqual(BRAND_NO_COLORS.tokens.type);
  });
});

describe('applyDemoOverlay: githubColorFallback signal', () => {
  it('is true for github source when color tokens are empty', () => {
    const { meta } = applyDemoOverlay(BRAND_NO_COLORS, GITHUB_PARAMS);
    expect(meta.githubColorFallback).toBe(true);
  });

  it('is false for github source when color tokens are present', () => {
    const { meta } = applyDemoOverlay(BRAND_WITH_COLORS, GITHUB_PARAMS);
    expect(meta.githubColorFallback).toBe(false);
  });

  it.each(ALL_NON_GITHUB_PARAMS)(
    'is false for %s source even when color tokens are empty',
    (_label, params) => {
      const { meta } = applyDemoOverlay(BRAND_NO_COLORS, params);
      expect(meta.githubColorFallback).toBe(false);
    },
  );

  it('co-occurs with colorFallbackActive when github source has empty color tokens', () => {
    const { meta } = applyDemoOverlay(BRAND_NO_COLORS, GITHUB_PARAMS);
    expect(meta.colorFallbackActive).toBe(true);
    expect(meta.githubColorFallback).toBe(true);
  });

  it('is independent of brand voice, assets, and type tokens', () => {
    const brandVariants: VbrandType[] = [
      BRAND_NO_TOKENS,
      { ...BRAND_NO_COLORS, voice: { canonical: 'X', repoDescription: 'Y' } },
      { ...BRAND_NO_COLORS, name: 'AltName' },
    ];
    for (const brand of brandVariants) {
      const { meta } = applyDemoOverlay(brand, GITHUB_PARAMS);
      expect(meta.githubColorFallback).toBe(true);
    }
  });

  it('is false when github source provides exactly one color token', () => {
    const brand = { ...BRAND_WITH_COLORS, tokens: { ...BRAND_WITH_COLORS.tokens, color: { primary: '#3178c6' } } };
    const { meta } = applyDemoOverlay(brand, GITHUB_PARAMS);
    expect(meta.githubColorFallback).toBe(false);
    expect(meta.colorFallbackActive).toBe(false);
  });
});

describe('applyDemoOverlay: faviconBundled signal and favicon overlay', () => {
  it('is true for fixture:stripe and replaces the favicon source', () => {
    const { meta, brand } = applyDemoOverlay(BRAND_WITH_COLORS, FIXTURE_STRIPE_PARAMS);
    expect(meta.faviconBundled).toBe(true);
    expect(brand.assets.favicon.source).not.toBe(BRAND_WITH_COLORS.assets.favicon.source);
  });

  it('bundled favicon source is a relative path (no scheme)', () => {
    const { brand } = applyDemoOverlay(BRAND_WITH_COLORS, FIXTURE_STRIPE_PARAMS);
    expect(brand.assets.favicon.source).not.toMatch(/^[a-z]+:\/\//i);
  });

  it('bundled favicon includes at least one size value', () => {
    const { brand } = applyDemoOverlay(BRAND_WITH_COLORS, FIXTURE_STRIPE_PARAMS);
    expect(brand.assets.favicon.sizes.length).toBeGreaterThan(0);
  });

  it('is false for fixture:vercel (no bundled override)', () => {
    const { meta } = applyDemoOverlay(BRAND_WITH_COLORS, FIXTURE_VERCEL_PARAMS);
    expect(meta.faviconBundled).toBe(false);
  });

  it.each(ALL_NON_GITHUB_PARAMS.filter(([l]) => l !== 'fixture:stripe'))(
    'is false for %s source',
    (_label, params) => {
      const { meta } = applyDemoOverlay(BRAND_WITH_COLORS, params);
      expect(meta.faviconBundled).toBe(false);
    },
  );

  it('is false for github source', () => {
    const { meta } = applyDemoOverlay(BRAND_WITH_COLORS, GITHUB_PARAMS);
    expect(meta.faviconBundled).toBe(false);
  });

  it('non-favicon fields are not modified by the favicon overlay', () => {
    const { brand } = applyDemoOverlay(BRAND_WITH_COLORS, FIXTURE_STRIPE_PARAMS);
    expect(brand.name).toBe(BRAND_WITH_COLORS.name);
    expect(brand.tokens.color).toEqual(BRAND_WITH_COLORS.tokens.color);
    expect(brand.voice).toEqual(BRAND_WITH_COLORS.voice);
  });
});

describe('applyDemoOverlay: brand identity preservation', () => {
  it('name is unchanged after overlay', () => {
    const { brand } = applyDemoOverlay(BRAND_WITH_COLORS, URL_PARAMS);
    expect(brand.name).toBe(BRAND_WITH_COLORS.name);
  });

  it('voice fields are unchanged after overlay', () => {
    const { brand } = applyDemoOverlay(BRAND_WITH_COLORS, URL_PARAMS);
    expect(brand.voice).toEqual(BRAND_WITH_COLORS.voice);
  });

  it('sources array is unchanged after overlay', () => {
    const { brand } = applyDemoOverlay(BRAND_WITH_COLORS, URL_PARAMS);
    expect(brand.sources).toEqual(BRAND_WITH_COLORS.sources);
  });

  it('og asset is unchanged after overlay', () => {
    const { brand } = applyDemoOverlay(BRAND_WITH_COLORS, URL_PARAMS);
    expect(brand.assets.og).toEqual(BRAND_WITH_COLORS.assets.og);
  });

  it('icons asset is unchanged after overlay', () => {
    const { brand } = applyDemoOverlay(BRAND_WITH_COLORS, URL_PARAMS);
    expect(brand.assets.icons).toEqual(BRAND_WITH_COLORS.assets.icons);
  });

  it('returned brand object is not the same reference as the input (immutable overlay)', () => {
    const { brand } = applyDemoOverlay(BRAND_NO_COLORS, URL_PARAMS);
    expect(brand).not.toBe(BRAND_NO_COLORS);
  });

  it('input brand is not mutated by the overlay', () => {
    const originalColorCount = Object.keys(BRAND_NO_COLORS.tokens.color).length;
    applyDemoOverlay(BRAND_NO_COLORS, URL_PARAMS);
    expect(Object.keys(BRAND_NO_COLORS.tokens.color).length).toBe(originalColorCount);
  });
});
