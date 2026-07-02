// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { describe, expect, it } from 'vitest';
import { OVERRIDABLE_FIELDS } from '../content/fields.js';
import { VbrandSchema } from '../schema.js';
import { CMS_FIXTURE_SLUGS, CMS_NAMES, CMS_SUBSTRATE_REGISTRY, DEFAULT_CMS, getCmsSubstrate, loadFixtureContentTree, normalizePayloadResponse, normalizeSanityResponse, normalizeStrapiResponse, parseCms, payloadPagesFixture, sanityPagesFixture, strapiPagesFixture } from './index.js';
import { assertKnownContentKeys, brandToContentTree, canonicalDataset, DEFAULT_CONTENT_FIXTURE, loadFixtureBrand, loadFixtureSchema, overridableFieldKeys, resolveFixtureSlug } from './content-tree.js';

const knownKeys = new Set<string>(Object.values(OVERRIDABLE_FIELDS).flat().map((field) => field.key));

describe('CmsSubstrateAdapter contract', () => {
  it('keeps registry keys and adapter names aligned', async () => {
    expect(Object.keys(CMS_SUBSTRATE_REGISTRY).sort()).toEqual([...CMS_NAMES].sort());
    for (const name of CMS_NAMES) {
      const adapter = CMS_SUBSTRATE_REGISTRY[name];
      expect(adapter.name()).toBe(name);
      expect(await adapter.loadContent()).toBeTruthy();
      expect(VbrandSchema.safeParse(await adapter.loadSchema()).success).toBe(true);
    }
  });

  it('parses invalid CMS input to the documented default', () => {
    expect(parseCms(null)).toBe(DEFAULT_CMS);
    expect(parseCms(undefined)).toBe(DEFAULT_CMS);
    expect(parseCms('wordpress')).toBe(DEFAULT_CMS);
    expect(parseCms('sanity')).toBe('sanity');
  });

  it('returns only known overridable dotted keys', async () => {
    for (const adapter of Object.values(CMS_SUBSTRATE_REGISTRY)) {
      const content = await adapter.loadContent();
      expect(Object.keys(content).length).toBeGreaterThan(0);
      expect(Object.keys(content).every((key) => knownKeys.has(key))).toBe(true);
    }
  });

  it('normalizes every shipped fixture to canonical parity', () => {
    for (const slug of CMS_FIXTURE_SLUGS) {
      const expected = loadFixtureContentTree(slug);
      expect(normalizePayloadResponse(payloadPagesFixture(), slug)).toEqual(expected);
      expect(normalizeSanityResponse(sanityPagesFixture(), slug)).toEqual(expected);
      expect(normalizeStrapiResponse(strapiPagesFixture(), slug)).toEqual(expected);
    }
  });

  it('loadContent(slug) returns the canonical content tree for every fixture across all substrates', async () => {
    for (const slug of CMS_FIXTURE_SLUGS) {
      const expected = loadFixtureContentTree(slug);
      for (const adapter of Object.values(CMS_SUBSTRATE_REGISTRY)) {
        expect(await adapter.loadContent(slug)).toEqual(expected);
      }
    }
  });

  it('loadContent() with no argument, with undefined, and with DEFAULT_CONTENT_FIXTURE all produce the same tree', async () => {
    for (const adapter of Object.values(CMS_SUBSTRATE_REGISTRY)) {
      const noArg = await adapter.loadContent();
      const withUndefined = await adapter.loadContent(undefined);
      const withDefault = await adapter.loadContent(DEFAULT_CONTENT_FIXTURE);
      expect(noArg).toEqual(withUndefined);
      expect(noArg).toEqual(withDefault);
    }
  });

  it('loadContent(slug) yields content distinct from the default fixture for every non-default fixture', async () => {
    const defaultContent = loadFixtureContentTree(DEFAULT_CONTENT_FIXTURE);
    for (const slug of CMS_FIXTURE_SLUGS.filter((s) => s !== DEFAULT_CONTENT_FIXTURE)) {
      const alternateContent = loadFixtureContentTree(slug);
      expect(alternateContent).not.toEqual(defaultContent);
      for (const adapter of Object.values(CMS_SUBSTRATE_REGISTRY)) {
        expect(await adapter.loadContent(slug)).not.toEqual(defaultContent);
      }
    }
  });

  it('loadContent(slug) with an unrecognised slug falls back to the default fixture for every substrate', async () => {
    const defaultContent = loadFixtureContentTree(DEFAULT_CONTENT_FIXTURE);
    for (const adapter of Object.values(CMS_SUBSTRATE_REGISTRY)) {
      expect(await adapter.loadContent('wordpress')).toEqual(defaultContent);
      expect(await adapter.loadContent('')).toEqual(defaultContent);
    }
  });

  it('fails fast when fixture responses contain no pages', () => {
    expect(() => normalizePayloadResponse({ docs: [] })).toThrow('Payload fixture contains no pages');
    expect(() => normalizeSanityResponse({ result: [] })).toThrow('Sanity fixture contains no pages');
    expect(() => normalizeStrapiResponse({ data: [] })).toThrow('Strapi fixture contains no pages');
  });
});

describe('CmsSubstrateAdapter parser and registry contract', () => {
  it('parseCms accepts every member of CMS_NAMES verbatim', () => {
    for (const name of CMS_NAMES) expect(parseCms(name)).toBe(name);
  });

  it('parseCms is case-sensitive: uppercase and mixed-case values fall back to DEFAULT_CMS', () => {
    for (const bad of ['Sanity', 'PAYLOAD', 'Strapi', 'VBrand-Standalone', 'VBRAND-STANDALONE']) {
      expect(parseCms(bad)).toBe(DEFAULT_CMS);
    }
  });

  it('DEFAULT_CMS is vbrand-standalone', () => {
    expect(DEFAULT_CMS).toBe('vbrand-standalone');
  });

  it('CMS_NAMES contains exactly the four expected substrate names and no others', () => {
    expect([...CMS_NAMES].sort()).toEqual(['payload', 'sanity', 'strapi', 'vbrand-standalone']);
    expect(CMS_NAMES).toHaveLength(4);
  });

  it('getCmsSubstrate returns the named adapter for every valid CMS name', () => {
    for (const name of CMS_NAMES) expect(getCmsSubstrate(name).name()).toBe(name);
  });

  it('loadSchema returns a VbrandSchema-conforming object for every substrate', async () => {
    for (const adapter of Object.values(CMS_SUBSTRATE_REGISTRY)) {
      expect(VbrandSchema.safeParse(await adapter.loadSchema()).success).toBe(true);
    }
  });

  it('content trees contain at least one landing-scope key across all substrates', async () => {
    for (const adapter of Object.values(CMS_SUBSTRATE_REGISTRY)) {
      const keys = Object.keys(await adapter.loadContent());
      expect(keys.some((key) => key.startsWith('landing.'))).toBe(true);
    }
  });

  it('assertKnownContentKeys accepts every content tree produced by every substrate', async () => {
    for (const adapter of Object.values(CMS_SUBSTRATE_REGISTRY)) {
      const content = await adapter.loadContent();
      expect(() => assertKnownContentKeys(content)).not.toThrow();
    }
  });

  it('each adapter returns a new content tree object on every call (no shared mutable reference)', async () => {
    for (const adapter of Object.values(CMS_SUBSTRATE_REGISTRY)) {
      const a = await adapter.loadContent();
      const b = await adapter.loadContent();
      expect(a).not.toBe(b);
      expect(a).toEqual(b);
    }
  });
});

describe('resolveFixtureSlug', () => {
  it('returns each recognized fixture slug unchanged', () => {
    for (const slug of CMS_FIXTURE_SLUGS) {
      expect(resolveFixtureSlug(slug)).toBe(slug);
    }
  });

  it('returns DEFAULT_CONTENT_FIXTURE for undefined', () => {
    expect(resolveFixtureSlug(undefined)).toBe(DEFAULT_CONTENT_FIXTURE);
  });

  it('returns DEFAULT_CONTENT_FIXTURE for empty string', () => {
    expect(resolveFixtureSlug('')).toBe(DEFAULT_CONTENT_FIXTURE);
  });

  it('returns DEFAULT_CONTENT_FIXTURE for any unrecognised string', () => {
    for (const bad of ['wordpress', 'contentful', 'ghost', 'unknown', 'STRIPE', 'Vercel']) {
      expect(resolveFixtureSlug(bad)).toBe(DEFAULT_CONTENT_FIXTURE);
    }
  });

  it('is case-sensitive: mixed-case variants of valid slugs fall back to DEFAULT_CONTENT_FIXTURE', () => {
    for (const slug of CMS_FIXTURE_SLUGS) {
      const upper = slug.toUpperCase();
      const capitalized = slug.charAt(0).toUpperCase() + slug.slice(1);
      if (upper !== slug) expect(resolveFixtureSlug(upper)).toBe(DEFAULT_CONTENT_FIXTURE);
      if (capitalized !== slug) expect(resolveFixtureSlug(capitalized)).toBe(DEFAULT_CONTENT_FIXTURE);
    }
  });

  it('DEFAULT_CONTENT_FIXTURE is a member of CMS_FIXTURE_SLUGS', () => {
    expect(CMS_FIXTURE_SLUGS).toContain(DEFAULT_CONTENT_FIXTURE);
  });
});

describe('parseCms - non-string and boundary inputs', () => {
  it('empty string falls back to DEFAULT_CMS', () => {
    expect(parseCms('')).toBe(DEFAULT_CMS);
  });

  it('numeric input falls back to DEFAULT_CMS', () => {
    expect(parseCms(0 as unknown as string)).toBe(DEFAULT_CMS);
    expect(parseCms(1 as unknown as string)).toBe(DEFAULT_CMS);
  });

  it('boolean input falls back to DEFAULT_CMS', () => {
    expect(parseCms(true as unknown as string)).toBe(DEFAULT_CMS);
    expect(parseCms(false as unknown as string)).toBe(DEFAULT_CMS);
  });

  it('object input falls back to DEFAULT_CMS', () => {
    expect(parseCms({} as unknown as string)).toBe(DEFAULT_CMS);
  });
});

describe('overridableFieldKeys - enumeration contract', () => {
  it('returns a non-empty array', () => {
    expect(overridableFieldKeys().length).toBeGreaterThan(0);
  });

  it('every key follows the dotted templateId.sectionId.fieldKey format', () => {
    for (const key of overridableFieldKeys()) {
      expect(key).toMatch(/^[a-z]+\.[a-z]+\.[a-z]+/);
    }
  });

  it('no key is duplicated across the full enumeration', () => {
    const keys = overridableFieldKeys();
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('returns the same key set on repeated calls', () => {
    expect(overridableFieldKeys()).toEqual(overridableFieldKeys());
  });

  it('each key is present in at least one OVERRIDABLE_FIELDS section', () => {
    const knownKeys = new Set(Object.values(OVERRIDABLE_FIELDS).flat().map((f) => f.key));
    for (const key of overridableFieldKeys()) {
      expect(knownKeys.has(key)).toBe(true);
    }
  });
});

describe('brandToContentTree - mapping invariants', () => {
  it('returns a non-null object for the default fixture brand', () => {
    expect(brandToContentTree(loadFixtureBrand())).toBeTruthy();
  });

  it('every key in the resulting ContentTree matches a known overridable field key', () => {
    const known = new Set(overridableFieldKeys());
    const tree = brandToContentTree(loadFixtureBrand());
    for (const key of Object.keys(tree)) {
      expect(known.has(key as Parameters<typeof known.has>[0])).toBe(true);
    }
  });

  it('produces distinct ContentTrees for distinct fixture brands', () => {
    const [first, second] = CMS_FIXTURE_SLUGS;
    expect(brandToContentTree(loadFixtureBrand(first))).not.toEqual(
      brandToContentTree(loadFixtureBrand(second)),
    );
  });

  it('two calls with the same brand produce equal but not identical objects', () => {
    const brand = loadFixtureBrand();
    const a = brandToContentTree(brand);
    const b = brandToContentTree(brand);
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });

  it('returns a frozen object so consumers cannot accidentally mutate the tree', () => {
    expect(Object.isFrozen(brandToContentTree(loadFixtureBrand()))).toBe(true);
  });
});

describe('loadFixtureBrand - fixture loading contract', () => {
  it('loads every shipped fixture slug without throwing', () => {
    for (const slug of CMS_FIXTURE_SLUGS) {
      expect(() => loadFixtureBrand(slug)).not.toThrow();
    }
  });

  it('distinct fixture slugs produce distinct brand objects', () => {
    const [first, second] = CMS_FIXTURE_SLUGS;
    expect(loadFixtureBrand(first)).not.toEqual(loadFixtureBrand(second));
  });

  it('call with no argument is equivalent to passing DEFAULT_CONTENT_FIXTURE', () => {
    expect(loadFixtureBrand()).toEqual(loadFixtureBrand(DEFAULT_CONTENT_FIXTURE));
  });

  it('each fixture brand satisfies VbrandSchema', () => {
    for (const slug of CMS_FIXTURE_SLUGS) {
      expect(VbrandSchema.safeParse(loadFixtureBrand(slug)).success).toBe(true);
    }
  });
});

describe('loadFixtureSchema - schema loading contract', () => {
  it('returns a VbrandSchema-conforming object for every shipped fixture', () => {
    for (const slug of CMS_FIXTURE_SLUGS) {
      expect(VbrandSchema.safeParse(loadFixtureSchema(slug)).success).toBe(true);
    }
  });

  it('schema for a slug is identical to the brand loaded for the same slug', () => {
    for (const slug of CMS_FIXTURE_SLUGS) {
      expect(loadFixtureSchema(slug)).toEqual(loadFixtureBrand(slug));
    }
  });

  it('call with no argument is equivalent to passing DEFAULT_CONTENT_FIXTURE', () => {
    expect(loadFixtureSchema()).toEqual(loadFixtureSchema(DEFAULT_CONTENT_FIXTURE));
  });

  it('distinct fixture slugs produce distinct schemas', () => {
    const [first, second] = CMS_FIXTURE_SLUGS;
    expect(loadFixtureSchema(first)).not.toEqual(loadFixtureSchema(second));
  });
});

describe('canonicalDataset - structure and completeness', () => {
  it('contains exactly one page per shipped fixture slug', () => {
    const dataset = canonicalDataset();
    expect(dataset.pages).toHaveLength(CMS_FIXTURE_SLUGS.length);
  });

  it('page fixture labels match CMS_FIXTURE_SLUGS in order', () => {
    const fixtures = canonicalDataset().pages.map((p) => p.fixture);
    expect(fixtures).toEqual(CMS_FIXTURE_SLUGS);
  });

  it('no duplicate fixture labels appear in the dataset', () => {
    const fixtures = canonicalDataset().pages.map((p) => p.fixture);
    expect(new Set(fixtures).size).toBe(fixtures.length);
  });

  it('each page brand matches loadFixtureBrand for that fixture', () => {
    for (const page of canonicalDataset().pages) {
      expect(page.brand).toEqual(loadFixtureBrand(page.fixture as Parameters<typeof loadFixtureBrand>[0]));
    }
  });

  it('each page content matches loadFixtureContentTree for that fixture', () => {
    for (const page of canonicalDataset().pages) {
      expect(page.content).toEqual(loadFixtureContentTree(page.fixture as Parameters<typeof loadFixtureBrand>[0]));
    }
  });

  it('each page content contains only known overridable keys', () => {
    for (const page of canonicalDataset().pages) {
      expect(() => assertKnownContentKeys(page.content)).not.toThrow();
    }
  });
});

describe('assertKnownContentKeys - validation contract', () => {
  it('returns the input tree unchanged when all keys are known', () => {
    const tree = loadFixtureContentTree(DEFAULT_CONTENT_FIXTURE);
    expect(assertKnownContentKeys(tree)).toBe(tree);
  });

  it('throws when the tree contains an unknown key', () => {
    const bad = { 'unknown.section.field': 'value' } as unknown as Parameters<typeof assertKnownContentKeys>[0];
    expect(() => assertKnownContentKeys(bad)).toThrow();
  });

  it('error message names the unrecognised key so callers can diagnose the mismatch', () => {
    const bad = { 'unknown.section.field': 'value' } as unknown as Parameters<typeof assertKnownContentKeys>[0];
    expect(() => assertKnownContentKeys(bad)).toThrow('unknown.section.field');
  });

  it('error message names every unrecognised key when multiple bad keys are present', () => {
    const bad = {
      'unknown.a.key': 'x',
      'unknown.b.key': 'y',
    } as unknown as Parameters<typeof assertKnownContentKeys>[0];
    let caught: Error | undefined;
    try { assertKnownContentKeys(bad); } catch (e) { caught = e as Error; }
    expect(caught).toBeDefined();
    expect(caught?.message).toContain('unknown.a.key');
    expect(caught?.message).toContain('unknown.b.key');
  });

  it('does not throw for an empty ContentTree', () => {
    expect(() => assertKnownContentKeys({} as Parameters<typeof assertKnownContentKeys>[0])).not.toThrow();
  });

  it('a mixed tree with one unknown key and valid keys throws and names only the unknown key', () => {
    const validKey = overridableFieldKeys()[0];
    const mixed = { [validKey]: 'ok', 'bad.unknown.key': 'oops' } as unknown as Parameters<typeof assertKnownContentKeys>[0];
    expect(() => assertKnownContentKeys(mixed)).toThrow('bad.unknown.key');
    expect(() => assertKnownContentKeys(mixed)).not.toThrow(validKey);
  });
});
