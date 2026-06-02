// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import type { VbrandType } from '@booga/vbrand/adapters/browser';
import { loadFromFixtureHandle } from '../../../src/adapters/brand-source/fixture-loader.js';
import { applyBrandTokens, clearBrandTokens } from '../src/brand-tokens.js';

const FIXTURE_HANDLES = ['stripe', 'linear', 'github', 'notion', 'vercel'] as const;
type FixtureHandle = (typeof FIXTURE_HANDLES)[number];

let fixtures: Record<FixtureHandle, VbrandType>;

beforeAll(async () => {
  const entries = await Promise.all(
    FIXTURE_HANDLES.map(async (h) => [h, await loadFromFixtureHandle(h)] as const),
  );
  fixtures = Object.fromEntries(entries) as Record<FixtureHandle, VbrandType>;
});

beforeEach(() => {
  document.documentElement.removeAttribute('style');
});

describe('applyBrandTokens: maps color tokens to --color-<key> on :root', () => {
  it.each(FIXTURE_HANDLES)(
    '%s: --color-primary on :root matches the fixture token value',
    (handle) => {
      applyBrandTokens(fixtures[handle]);
      const expected = fixtures[handle].tokens.color['primary'] ?? '';
      expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe(expected);
    },
  );

  it('every color key from the stripe fixture is applied under the --color- namespace', () => {
    applyBrandTokens(fixtures.stripe);
    for (const [key, value] of Object.entries(fixtures.stripe.tokens.color)) {
      expect(document.documentElement.style.getPropertyValue(`--color-${key}`)).toBe(value);
    }
  });
});

describe('applyBrandTokens: maps type tokens to both --type-<key> and --font-<key>', () => {
  it('every type key from the stripe fixture is set under both --type- and --font- prefixes', () => {
    applyBrandTokens(fixtures.stripe);
    for (const key of Object.keys(fixtures.stripe.tokens.type)) {
      const typeVal = document.documentElement.style.getPropertyValue(`--type-${key}`);
      const fontVal = document.documentElement.style.getPropertyValue(`--font-${key}`);
      expect(typeVal.length).toBeGreaterThan(0);
      expect(fontVal).toBe(typeVal);
    }
  });
});

describe('applyBrandTokens: return value contract', () => {
  it('returns a non-empty array of property names for a brand with tokens', () => {
    const keys = applyBrandTokens(fixtures.stripe);
    expect(keys.length).toBeGreaterThan(0);
  });

  it('returned array contains a --color- entry for every color token key', () => {
    const keys = applyBrandTokens(fixtures.stripe);
    for (const key of Object.keys(fixtures.stripe.tokens.color)) {
      expect(keys).toContain(`--color-${key}`);
    }
  });

  it('returned array contains both --type- and --font- entries for every type token key', () => {
    const keys = applyBrandTokens(fixtures.stripe);
    for (const key of Object.keys(fixtures.stripe.tokens.type)) {
      expect(keys).toContain(`--type-${key}`);
      expect(keys).toContain(`--font-${key}`);
    }
  });

  it('returns an empty array when both token maps are empty', () => {
    const emptyBrand: VbrandType = { ...fixtures.stripe, tokens: { color: {}, type: {} } };
    expect(applyBrandTokens(emptyBrand)).toHaveLength(0);
  });
});

describe('clearBrandTokens: removes previously applied custom properties', () => {
  it('all applied keys resolve to empty string after clear', () => {
    const keys = applyBrandTokens(fixtures.stripe);
    clearBrandTokens(keys);
    for (const key of keys) {
      expect(document.documentElement.style.getPropertyValue(key)).toBe('');
    }
  });

  it('calling clearBrandTokens with an empty array is a no-op', () => {
    expect(() => clearBrandTokens([])).not.toThrow();
  });

  it('duplicate keys in the argument array do not throw and the property is still cleared', () => {
    const keys = applyBrandTokens(fixtures.stripe);
    const withDuplicates = [...keys, ...keys];
    expect(() => clearBrandTokens(withDuplicates)).not.toThrow();
    expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe('');
  });

  it('brand swap: applying brand B after clearing brand A yields B tokens on :root', () => {
    const keysA = applyBrandTokens(fixtures.stripe);
    clearBrandTokens(keysA);
    applyBrandTokens(fixtures.github);
    expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe(
      fixtures.github.tokens.color['primary'] ?? '',
    );
  });

  it('brand swap: stripe color tokens absent in github are empty after clear + github apply', () => {
    const stripeColorKeys = Object.keys(fixtures.stripe.tokens.color);
    const githubColorKeys = new Set(Object.keys(fixtures.github.tokens.color));
    const stripeOnlyKeys = stripeColorKeys.filter((k) => !githubColorKeys.has(k));

    if (stripeOnlyKeys.length > 0) {
      const keysA = applyBrandTokens(fixtures.stripe);
      clearBrandTokens(keysA);
      applyBrandTokens(fixtures.github);
      for (const key of stripeOnlyKeys) {
        expect(document.documentElement.style.getPropertyValue(`--color-${key}`)).toBe('');
      }
    }
  });
});
