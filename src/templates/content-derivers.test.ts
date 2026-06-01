// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { describe, expect, it } from 'vitest';
import type { VbrandType } from '../schema.js';
import {
  toBlockDensity,
  deriveHeroContent,
  deriveFeaturesContent,
  deriveCtaContent,
  deriveFooterContent,
  deriveTestimonialContent,
  deriveBlogContent,
  deriveThemeOverride,
  type BlockDensity,
} from './content-derivers.js';
import type { Density } from '../composition/spec.js';

const MINIMAL_BRAND: VbrandType = {
  name: 'TestBrand',
  voice: { canonical: 'Clean and precise.', repoDescription: 'A test brand for unit tests.' },
  assets: {
    favicon: { source: 'favicon.png', sizes: [32] },
    og: { dimensions: [1200, 630] },
    icons: { source: 'icons/', set: [] },
  },
  tokens: { color: { primary: '#6366f1' }, type: {} },
};

const RICH_BRAND: VbrandType = {
  ...MINIMAL_BRAND,
  name: 'RichBrand',
  tokens: {
    color: { primary: '#6366f1', secondary: '#0ea5e9', accent: '#f59e0b' },
    type: { body: 'Inter, sans-serif', heading: 'Playfair Display, serif' },
  },
  sources: ['https://richbrand.com', 'https://github.com/richbrand'],
};

const BRAND_NO_SOURCES: VbrandType = {
  ...MINIMAL_BRAND,
  name: 'Sourceless',
  sources: undefined,
};

const BRAND_EMPTY_SOURCES: VbrandType = {
  ...MINIMAL_BRAND,
  name: 'EmptySources',
  sources: [],
};

describe('toBlockDensity - mapping exhaustiveness', () => {
  it.each<[Density | undefined, BlockDensity | undefined]>([
    [undefined,  undefined  ],
    ['compact',  'compact'  ],
    ['regular',  'normal'   ],
    ['spacious', 'spacious' ],
  ])('toBlockDensity(%s) === %s', (input, expected) => {
    expect(toBlockDensity(input)).toBe(expected);
  });

  it('maps every Density value to a defined BlockDensity', () => {
    const densities: Density[] = ['compact', 'regular', 'spacious'];
    for (const d of densities) {
      expect(toBlockDensity(d)).toBeDefined();
    }
  });
});

describe('deriveHeroContent - content derivation', () => {
  it('heading equals brand.name', () => {
    expect(deriveHeroContent(MINIMAL_BRAND).heading).toBe(MINIMAL_BRAND.name);
  });

  it('eyebrow equals brand.voice.canonical', () => {
    expect(deriveHeroContent(MINIMAL_BRAND).eyebrow).toBe(MINIMAL_BRAND.voice.canonical);
  });

  it('description equals brand.voice.repoDescription', () => {
    expect(deriveHeroContent(MINIMAL_BRAND).description).toBe(MINIMAL_BRAND.voice.repoDescription);
  });

  it('image.src equals brand.assets.favicon.source', () => {
    expect(deriveHeroContent(MINIMAL_BRAND).image.src).toBe(MINIMAL_BRAND.assets.favicon.source);
  });

  it('image.alt contains brand.name', () => {
    expect(deriveHeroContent(MINIMAL_BRAND).image.alt).toContain(MINIMAL_BRAND.name);
  });

  it('density is undefined when not passed', () => {
    expect(deriveHeroContent(MINIMAL_BRAND).density).toBeUndefined();
  });

  it.each<[Density, BlockDensity]>([
    ['compact',  'compact'  ],
    ['regular',  'normal'   ],
    ['spacious', 'spacious' ],
  ])('density "%s" maps to "%s"', (input, expected) => {
    expect(deriveHeroContent(MINIMAL_BRAND, input).density).toBe(expected);
  });
});

describe('deriveFeaturesContent - content derivation', () => {
  it('heading contains brand.name', () => {
    expect(deriveFeaturesContent(MINIMAL_BRAND).heading).toContain(MINIMAL_BRAND.name);
  });

  it('features array has exactly 4 items', () => {
    expect(deriveFeaturesContent(MINIMAL_BRAND).features).toHaveLength(4);
  });

  it('all feature titles are non-empty strings', () => {
    for (const f of deriveFeaturesContent(MINIMAL_BRAND).features) {
      expect(typeof f.title).toBe('string');
      expect(f.title.length).toBeGreaterThan(0);
    }
  });

  it('color token feature description reflects actual token count', () => {
    const brand = { ...MINIMAL_BRAND, tokens: { color: { a: '#f00', b: '#0f0', c: '#00f' }, type: {} } };
    const features = deriveFeaturesContent(brand as VbrandType).features;
    const colorFeature = features.find((f) => f.title.toLowerCase().includes('color'));
    expect(colorFeature!.description).toContain('3');
  });

  it('type token feature description reflects actual token count', () => {
    const brand = { ...MINIMAL_BRAND, tokens: { color: { primary: '#f00' }, type: { body: 'Inter', heading: 'Serif' } } };
    const features = deriveFeaturesContent(brand as VbrandType).features;
    const typeFeature = features.find((f) => f.title.toLowerCase().includes('type'));
    expect(typeFeature!.description).toContain('2');
  });

  it('density is undefined when not passed', () => {
    expect(deriveFeaturesContent(MINIMAL_BRAND).density).toBeUndefined();
  });

  it('density "regular" maps to "normal"', () => {
    expect(deriveFeaturesContent(MINIMAL_BRAND, 'regular').density).toBe('normal');
  });
});

describe('deriveCtaContent - content derivation', () => {
  it('heading contains brand.name', () => {
    expect(deriveCtaContent(MINIMAL_BRAND).heading).toContain(MINIMAL_BRAND.name);
  });

  it('description equals brand.voice.repoDescription', () => {
    expect(deriveCtaContent(MINIMAL_BRAND).description).toBe(MINIMAL_BRAND.voice.repoDescription);
  });

  it('primaryCta has non-empty label and href', () => {
    const cta = deriveCtaContent(MINIMAL_BRAND).primaryCta;
    expect(cta.label.length).toBeGreaterThan(0);
    expect(cta.href.length).toBeGreaterThan(0);
  });

  it('density is undefined when not passed', () => {
    expect(deriveCtaContent(MINIMAL_BRAND).density).toBeUndefined();
  });

  it('density "regular" maps to "normal"', () => {
    expect(deriveCtaContent(MINIMAL_BRAND, 'regular').density).toBe('normal');
  });
});

describe('deriveFooterContent - links invariant (never empty)', () => {
  it('links is non-empty when brand has no sources field', () => {
    expect(deriveFooterContent(BRAND_NO_SOURCES).links.length).toBeGreaterThan(0);
  });

  it('links is non-empty when brand.sources is an empty array', () => {
    expect(deriveFooterContent(BRAND_EMPTY_SOURCES).links.length).toBeGreaterThan(0);
  });

  it('links count equals sources.length when brand has sources', () => {
    const content = deriveFooterContent(RICH_BRAND);
    expect(content.links).toHaveLength(RICH_BRAND.sources!.length);
  });

  it('each link has non-empty label and href', () => {
    for (const link of deriveFooterContent(RICH_BRAND).links) {
      expect(link.label.length).toBeGreaterThan(0);
      expect(link.href.length).toBeGreaterThan(0);
    }
  });

  it('brand name appears in footer brand.name field', () => {
    expect(deriveFooterContent(MINIMAL_BRAND).brand.name).toBe(MINIMAL_BRAND.name);
  });

  it('copyright string contains brand.name', () => {
    expect(deriveFooterContent(MINIMAL_BRAND).copyright).toContain(MINIMAL_BRAND.name);
  });

  it('density is undefined when not passed', () => {
    expect(deriveFooterContent(MINIMAL_BRAND).density).toBeUndefined();
  });

  it('density "regular" maps to "normal"', () => {
    expect(deriveFooterContent(MINIMAL_BRAND, 'regular').density).toBe('normal');
  });
});

describe('deriveTestimonialContent - shape invariants', () => {
  it('returns an object with quote, author, and role as strings', () => {
    const content = deriveTestimonialContent();
    expect(typeof content.quote).toBe('string');
    expect(typeof content.author).toBe('string');
    expect(typeof content.role).toBe('string');
  });

  it('quote is a non-empty string', () => {
    expect(deriveTestimonialContent().quote.length).toBeGreaterThan(0);
  });

  it('returns the same shape on every call', () => {
    const a = deriveTestimonialContent();
    const b = deriveTestimonialContent();
    expect(a).toEqual(b);
  });

  it('has no extra fields beyond quote, author, role', () => {
    const keys = Object.keys(deriveTestimonialContent());
    expect(keys.sort()).toEqual(['author', 'quote', 'role']);
  });
});

describe('deriveBlogContent - content derivation', () => {
  it('heading contains brand.name', () => {
    expect(deriveBlogContent(MINIMAL_BRAND).heading).toContain(MINIMAL_BRAND.name);
  });

  it('posts array is non-empty', () => {
    expect(deriveBlogContent(MINIMAL_BRAND).posts.length).toBeGreaterThan(0);
  });

  it('first post excerpt equals brand.voice.canonical', () => {
    expect(deriveBlogContent(MINIMAL_BRAND).posts[0]!.excerpt).toBe(MINIMAL_BRAND.voice.canonical);
  });

  it('first post author equals brand.name', () => {
    expect(deriveBlogContent(MINIMAL_BRAND).posts[0]!.author).toBe(MINIMAL_BRAND.name);
  });

  it('density is undefined when not passed', () => {
    expect(deriveBlogContent(MINIMAL_BRAND).density).toBeUndefined();
  });

  it('density "regular" maps to "normal"', () => {
    expect(deriveBlogContent(MINIMAL_BRAND, 'regular').density).toBe('normal');
  });
});

describe('deriveThemeOverride - CSS variable mapping', () => {
  it('returns a plain object', () => {
    expect(typeof deriveThemeOverride(MINIMAL_BRAND)).toBe('object');
  });

  it('maps tokens.color.primary to --color-primary', () => {
    const overrides = deriveThemeOverride(RICH_BRAND);
    expect(overrides['--color-primary']).toBe(RICH_BRAND.tokens.color['primary']);
  });

  it('maps tokens.color.secondary to --color-secondary', () => {
    const overrides = deriveThemeOverride(RICH_BRAND);
    expect(overrides['--color-secondary']).toBe(RICH_BRAND.tokens.color['secondary']);
  });

  it('maps tokens.type.body to --font-body', () => {
    const overrides = deriveThemeOverride(RICH_BRAND);
    expect(overrides['--font-body']).toBe(RICH_BRAND.tokens.type['body']);
  });

  it('maps tokens.type.heading to --font-heading', () => {
    const overrides = deriveThemeOverride(RICH_BRAND);
    expect(overrides['--font-heading']).toBe(RICH_BRAND.tokens.type['heading']);
  });

  it('absent color.primary produces no --color-primary key', () => {
    const overrides = deriveThemeOverride(MINIMAL_BRAND);
    expect('--color-secondary' in overrides).toBe(false);
  });

  it('absent type tokens produce no font override keys', () => {
    const overrides = deriveThemeOverride(MINIMAL_BRAND);
    expect('--font-body' in overrides).toBe(false);
    expect('--font-heading' in overrides).toBe(false);
  });

  it('returns empty object when no matching token keys are present', () => {
    const plain: VbrandType = {
      ...MINIMAL_BRAND,
      tokens: { color: { accent: '#f00' }, type: { mono: 'JetBrains Mono' } },
    };
    expect(deriveThemeOverride(plain)).toEqual({});
  });

  it('value for each override key is the raw token value string', () => {
    const overrides = deriveThemeOverride(RICH_BRAND);
    for (const value of Object.values(overrides)) {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    }
  });
});
