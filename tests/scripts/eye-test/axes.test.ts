// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { describe, it, expect, beforeAll, vi } from 'vitest';

type AxesModule = {
  FIXTURES: string[];
  APP_TYPES: string[];
  MODES: string[];
  STACKS: string[];
  CMS_SUBSTRATES: string[];
};

let FIXTURES: string[];
let APP_TYPES: string[];
let MODES: string[];
let STACKS: string[];
let CMS_SUBSTRATES: string[];

beforeAll(async () => {
  const mod = await vi.importActual<AxesModule>('../../../scripts/eye-test/axes.mjs');
  ({ FIXTURES, APP_TYPES, MODES, STACKS, CMS_SUBSTRATES } = mod);
});

const ALL_AXIS_NAMES = ['FIXTURES', 'APP_TYPES', 'MODES', 'STACKS', 'CMS_SUBSTRATES'] as const;

describe('axes - structural contract', () => {
  it.each(ALL_AXIS_NAMES)('%s is a non-empty array', (name) => {
    const map: Record<string, string[]> = { FIXTURES, APP_TYPES, MODES, STACKS, CMS_SUBSTRATES };
    expect(Array.isArray(map[name])).toBe(true);
    expect(map[name].length).toBeGreaterThan(0);
  });

  it('all entries across every axis are non-empty strings', () => {
    for (const axis of [FIXTURES, APP_TYPES, MODES, STACKS, CMS_SUBSTRATES]) {
      for (const v of axis) {
        expect(typeof v).toBe('string');
        expect(v.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('axes - uniqueness within each axis', () => {
  it('FIXTURES has no duplicate values', () => {
    expect(new Set(FIXTURES).size).toBe(FIXTURES.length);
  });

  it('APP_TYPES has no duplicate values', () => {
    expect(new Set(APP_TYPES).size).toBe(APP_TYPES.length);
  });

  it('MODES has no duplicate values', () => {
    expect(new Set(MODES).size).toBe(MODES.length);
  });

  it('STACKS has no duplicate values', () => {
    expect(new Set(STACKS).size).toBe(STACKS.length);
  });

  it('CMS_SUBSTRATES has no duplicate values', () => {
    expect(new Set(CMS_SUBSTRATES).size).toBe(CMS_SUBSTRATES.length);
  });
});

describe('axes - protocol values (C-152 eye-test contract)', () => {
  it('FIXTURES contains exactly the five brand fixture slugs', () => {
    expect(FIXTURES.slice().sort()).toEqual(['github', 'linear', 'notion', 'stripe', 'vercel']);
  });

  it('APP_TYPES contains exactly the four demo template identifiers', () => {
    expect(APP_TYPES.slice().sort()).toEqual(['dashboard', 'docs', 'landing', 'marketing']);
  });

  it('MODES contains exactly the three interactivity modes', () => {
    expect(MODES.slice().sort()).toEqual(['hybrid', 'spa', 'static']);
  });

  it('STACKS contains exactly the three supported framework stacks', () => {
    expect(STACKS.slice().sort()).toEqual(['astro', 'next', 'vite']);
  });

  it('CMS_SUBSTRATES contains exactly the four CMS integration targets', () => {
    expect(CMS_SUBSTRATES.slice().sort()).toEqual(['payload', 'sanity', 'strapi', 'vbrand-standalone']);
  });
});

describe('axes - orthogonality', () => {
  it('no value appears in more than one axis', () => {
    const all = [...FIXTURES, ...APP_TYPES, ...MODES, ...STACKS, ...CMS_SUBSTRATES];
    expect(new Set(all).size).toBe(all.length);
  });

  it('product of all five axis lengths equals the exhaustive cell count', () => {
    const product = FIXTURES.length * APP_TYPES.length * MODES.length * STACKS.length * CMS_SUBSTRATES.length;
    expect(product).toBe(720);
  });
});
