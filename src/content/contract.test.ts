// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { describe, it, expect } from 'vitest';
import { fixtures } from '@booga/vfixtures';
import {
  CONTENT_OVERRIDE_KEYS,
  ContentOverrideMapSchema,
  type ContentOverrideMap,
} from './override.js';
import { applyContentOverride } from './apply.js';
import { encodeContent, decodeContent, contentFromHash, contentToHash } from './hash.js';
import { encodeComposition } from '../composition/spec.js';
import { OVERRIDABLE_FIELDS } from './fields.js';
import {
  deriveHeroContent,
  deriveFeaturesContent,
  deriveCtaContent,
  deriveFooterContent,
  deriveDocsSidebarContent,
  deriveDocsArticleContent,
  deriveDocsTocContent,
  deriveDashboardSidebarContent,
  deriveDashboardStatsContent,
  deriveDashboardGridContent,
  deriveMarketingTestimonialsContent,
  deriveMarketingPricingContent,
} from '../templates/content-derivers.js';

const brand = fixtures.stripe;

describe('ContentOverrideKey enumeration', () => {
  it('contains exactly 21 keys covering all 4 templates', () => {
    expect(CONTENT_OVERRIDE_KEYS).toHaveLength(21);
  });

  it('every key follows the <template>.<section>.<field> dot-separated pattern', () => {
    for (const key of CONTENT_OVERRIDE_KEYS) {
      expect(key.split('.').length).toBeGreaterThanOrEqual(3);
    }
  });

  it('all 4 template prefixes are represented', () => {
    const prefixes = new Set(CONTENT_OVERRIDE_KEYS.map((k) => k.split('.')[0]));
    expect([...prefixes].sort()).toEqual(['dashboard', 'docs', 'landing', 'marketing']);
  });
});

describe('ContentOverrideMapSchema validation', () => {
  it('accepts an empty map', () => {
    expect(ContentOverrideMapSchema.safeParse({}).success).toBe(true);
  });

  it('accepts a map with a valid string value', () => {
    expect(ContentOverrideMapSchema.safeParse({ 'landing.hero.heading': 'Custom' }).success).toBe(true);
  });

  it('accepts a map with a valid string-array value', () => {
    expect(ContentOverrideMapSchema.safeParse({ 'landing.hero.heading': ['a', 'b'] }).success).toBe(true);
  });

  it('rejects a key that is not in the valid key set', () => {
    expect(ContentOverrideMapSchema.safeParse({ 'landing.hero.unknown': 'x' }).success).toBe(false);
  });

  it('rejects a value that is a number', () => {
    expect(ContentOverrideMapSchema.safeParse({ 'landing.hero.heading': 42 }).success).toBe(false);
  });

  it('rejects a key with wrong segment count', () => {
    expect(ContentOverrideMapSchema.safeParse({ 'landing.hero': 'x' }).success).toBe(false);
  });

  it('rejects a dotted key not in the registry even if structurally valid', () => {
    expect(ContentOverrideMapSchema.safeParse({ 'landing.nonexistent.field': 'x' }).success).toBe(false);
  });
});

describe('applyContentOverride: no-op cases', () => {
  it('returns derived unchanged when overrides is undefined', () => {
    const derived = deriveHeroContent(brand);
    expect(applyContentOverride(derived, undefined, 'landing.hero')).toBe(derived);
  });

  it('returns derived unchanged when overrides is an empty map', () => {
    const derived = deriveHeroContent(brand);
    const result = applyContentOverride(derived, {}, 'landing.hero');
    expect(result).toBe(derived);
  });

  it('returns derived unchanged when no overrides match the scope', () => {
    const derived = deriveHeroContent(brand);
    const overrides: ContentOverrideMap = { 'landing.cta.heading': 'Other' };
    const result = applyContentOverride(derived, overrides, 'landing.hero');
    expect(result).toBe(derived);
  });
});

describe('applyContentOverride: top-level field override', () => {
  it('override value replaces the derived default for a matching top-level field', () => {
    const derived = deriveHeroContent(brand);
    const overrides: ContentOverrideMap = { 'landing.hero.heading': 'My Heading' };
    const result = applyContentOverride(derived, overrides, 'landing.hero');
    expect(result.heading).toBe('My Heading');
  });

  it('non-overridden fields retain their derived defaults', () => {
    const derived = deriveHeroContent(brand);
    const overrides: ContentOverrideMap = { 'landing.hero.heading': 'X' };
    const result = applyContentOverride(derived, overrides, 'landing.hero');
    expect(result.eyebrow).toBe(derived.eyebrow);
    expect(result.description).toBe(derived.description);
  });

  it('original derived object is not mutated', () => {
    const derived = deriveHeroContent(brand);
    const originalHeading = derived.heading;
    applyContentOverride(derived, { 'landing.hero.heading': 'Changed' }, 'landing.hero');
    expect(derived.heading).toBe(originalHeading);
  });
});

describe('applyContentOverride: nested path override', () => {
  it('nested path primaryCta.label overrides the label without affecting href', () => {
    const derived = deriveHeroContent(brand);
    const overrides: ContentOverrideMap = { 'landing.hero.primaryCta.label': 'Buy now' };
    const result = applyContentOverride(derived, overrides, 'landing.hero');
    expect((result.primaryCta as Record<string, unknown>)['label']).toBe('Buy now');
    expect((result.primaryCta as Record<string, unknown>)['href']).toBe('#');
  });

  it('nested CTA label applies to cta section', () => {
    const derived = deriveCtaContent(brand);
    const overrides: ContentOverrideMap = { 'landing.cta.primaryCta.label': 'Start free' };
    const result = applyContentOverride(derived, overrides, 'landing.cta');
    expect((result.primaryCta as Record<string, unknown>)['label']).toBe('Start free');
  });
});

describe('applyContentOverride: all 4 templates x representative fields', () => {
  it('landing: features heading', () => {
    const derived = deriveFeaturesContent(brand);
    const result = applyContentOverride(derived, { 'landing.features.heading': 'What we do' }, 'landing.features');
    expect(result.heading).toBe('What we do');
  });

  it('landing: footer copyright', () => {
    const derived = deriveFooterContent(brand);
    const result = applyContentOverride(derived, { 'landing.footer.copyright': 'Acme Corp 2026' }, 'landing.footer');
    expect(result.copyright).toBe('Acme Corp 2026');
  });

  it('marketing: testimonials heading', () => {
    const derived = deriveMarketingTestimonialsContent(brand);
    const result = applyContentOverride(derived, { 'marketing.testimonials.heading': 'Customers love us' }, 'marketing.testimonials');
    expect(result.heading).toBe('Customers love us');
  });

  it('marketing: pricing heading', () => {
    const derived = deriveMarketingPricingContent(brand);
    const result = applyContentOverride(derived, { 'marketing.pricing.heading': 'Choose your plan' }, 'marketing.pricing');
    expect(result.heading).toBe('Choose your plan');
  });

  it('docs: sidebar heading', () => {
    const derived = deriveDocsSidebarContent(brand);
    const result = applyContentOverride(derived, { 'docs.sidebar.heading': 'My Docs' }, 'docs.sidebar');
    expect(result.heading).toBe('My Docs');
  });

  it('docs: article title', () => {
    const derived = deriveDocsArticleContent(brand);
    const result = applyContentOverride(derived, { 'docs.article.title': 'Custom Title' }, 'docs.article');
    expect(result.title).toBe('Custom Title');
  });

  it('docs: toc heading', () => {
    const derived = deriveDocsTocContent(brand);
    const result = applyContentOverride(derived, { 'docs.toc.heading': 'Contents' }, 'docs.toc');
    expect(result.heading).toBe('Contents');
  });

  it('dashboard: sidebar heading', () => {
    const derived = deriveDashboardSidebarContent(brand);
    const result = applyContentOverride(derived, { 'dashboard.sidebar.heading': 'Admin' }, 'dashboard.sidebar');
    expect(result.heading).toBe('Admin');
  });

  it('dashboard: stats heading', () => {
    const derived = deriveDashboardStatsContent(brand);
    const result = applyContentOverride(derived, { 'dashboard.stats.heading': 'Metrics' }, 'dashboard.stats');
    expect(result.heading).toBe('Metrics');
  });

  it('dashboard: grid heading', () => {
    const derived = deriveDashboardGridContent();
    const result = applyContentOverride(derived, { 'dashboard.grid.heading': 'Palette' }, 'dashboard.grid');
    expect(result.heading).toBe('Palette');
  });
});

describe('applyContentOverride: multiple overrides in one call', () => {
  it('applies all matching overrides in a single pass', () => {
    const derived = deriveHeroContent(brand);
    const overrides: ContentOverrideMap = {
      'landing.hero.heading': 'H',
      'landing.hero.eyebrow': 'E',
      'landing.hero.description': 'D',
    };
    const result = applyContentOverride(derived, overrides, 'landing.hero');
    expect(result.heading).toBe('H');
    expect(result.eyebrow).toBe('E');
    expect(result.description).toBe('D');
  });
});

describe('encodeContent / decodeContent: round-trip', () => {
  const maps: ContentOverrideMap[] = [
    {},
    { 'landing.hero.heading': 'Hello' },
    { 'landing.hero.heading': 'Hello', 'landing.cta.heading': 'World' },
    { 'docs.article.title': 'My Guide', 'dashboard.grid.heading': 'Colors' },
  ];

  it.each(maps.map((m, i) => [i, m] as const))(
    'map %i: encode then decode recovers the original map',
    (_, map) => {
      const encoded = encodeContent(map);
      const decoded = decodeContent(encoded);
      expect(decoded).toEqual(map);
    },
  );

  it('decodeContent returns null for invalid base64', () => {
    expect(decodeContent('!!!not-base64!!!')).toBeNull();
  });

  it('decodeContent returns null for base64-encoded invalid JSON', () => {
    expect(decodeContent(btoa('{not json}'))).toBeNull();
  });

  it('decodeContent returns null for base64-encoded JSON with unknown keys', () => {
    expect(decodeContent(btoa(JSON.stringify({ 'landing.hero.unknown': 'x' })))).toBeNull();
  });
});

describe('contentFromHash / contentToHash: URL fragment co-existence', () => {
  it('contentFromHash returns null for an empty hash', () => {
    expect(contentFromHash('')).toBeNull();
    expect(contentFromHash('#')).toBeNull();
  });

  it('contentFromHash returns null when only composition key is in hash', () => {
    const composition = { sections: [{ id: 'hero', visible: true, density: 'regular' as const, order: 0 }] };
    const hash = `#composition=${encodeComposition(composition)}`;
    expect(contentFromHash(hash)).toBeNull();
  });

  it('contentFromHash reads only the content param, ignoring composition', () => {
    const map: ContentOverrideMap = { 'landing.hero.heading': 'Test' };
    const composition = { sections: [{ id: 'hero', visible: true, density: 'regular' as const, order: 0 }] };
    const hash = `#composition=${encodeComposition(composition)}&content=${encodeContent(map)}`;
    const result = contentFromHash(hash);
    expect(result).toEqual(map);
  });

  it('contentToHash + contentFromHash round-trip is lossless', () => {
    const map: ContentOverrideMap = {
      'marketing.hero.heading': 'Custom Hero',
      'docs.article.title': 'My Title',
    };
    const hash = `#${contentToHash(map)}`;
    expect(contentFromHash(hash)).toEqual(map);
  });

  it('hash key for content does not collide with composition key', () => {
    const contentHash = contentToHash({ 'landing.hero.heading': 'x' });
    expect(contentHash.startsWith('content=')).toBe(true);
    expect(contentHash.startsWith('composition=')).toBe(false);
  });
});

describe('OVERRIDABLE_FIELDS registry integrity', () => {
  const allTemplates = ['landing', 'marketing', 'docs', 'dashboard'] as const;

  it('every template has at least one field entry', () => {
    for (const t of allTemplates) {
      expect(OVERRIDABLE_FIELDS[t]!.length).toBeGreaterThan(0);
    }
  });

  it('every field key is a member of CONTENT_OVERRIDE_KEYS', () => {
    for (const fields of Object.values(OVERRIDABLE_FIELDS)) {
      for (const field of fields) {
        expect(CONTENT_OVERRIDE_KEYS).toContain(field.key);
      }
    }
  });

  it('every field key prefix matches its template bucket', () => {
    for (const [template, fields] of Object.entries(OVERRIDABLE_FIELDS)) {
      for (const field of fields) {
        expect(field.key.startsWith(`${template}.`)).toBe(true);
      }
    }
  });

  it('all defaultValue functions return non-empty strings for the stripe fixture', () => {
    for (const fields of Object.values(OVERRIDABLE_FIELDS)) {
      for (const field of fields) {
        const val = field.defaultValue(brand);
        expect(typeof val).toBe('string');
        expect(val.length).toBeGreaterThan(0);
      }
    }
  });

  it('no duplicate keys across all template buckets', () => {
    const all = Object.values(OVERRIDABLE_FIELDS).flatMap((f) => f.map((e) => e.key));
    expect(all.length).toBe(new Set(all).size);
  });
});
