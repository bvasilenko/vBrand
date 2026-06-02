// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { describe, expect, it } from 'vitest';
import {
  DensitySchema,
  SectionSpecSchema,
  CompositionSpecSchema,
  encodeComposition,
  decodeComposition,
  compositionFromHash,
  compositionToHash,
  sectionsByOrder,
  visibleSections,
  updateSection,
  reorderSections,
  type CompositionSpec,
  type SectionSpec,
} from './spec.js';

const makeSection = (
  id: string,
  order: number,
  visible = true,
  density: SectionSpec['density'] = 'regular',
): SectionSpec => ({ id, visible, density, order });

const twoSection: CompositionSpec = {
  sections: [makeSection('hero', 0), makeSection('footer', 1)],
};

const threeSection: CompositionSpec = {
  sections: [makeSection('hero', 0), makeSection('features', 1), makeSection('footer', 2)],
};

const reversedOrder: CompositionSpec = {
  sections: [makeSection('footer', 2), makeSection('features', 1), makeSection('hero', 0)],
};

describe('DensitySchema - valid values', () => {
  it.each(['compact', 'regular', 'spacious'] as const)(
    'accepts "%s"',
    (value) => {
      expect(DensitySchema.safeParse(value).success).toBe(true);
    },
  );

  it('rejects unknown density string', () => {
    expect(DensitySchema.safeParse('normal').success).toBe(false);
    expect(DensitySchema.safeParse('').success).toBe(false);
    expect(DensitySchema.safeParse(42).success).toBe(false);
  });
});

describe('SectionSpecSchema - shape invariants', () => {
  it('accepts a fully-populated valid section', () => {
    expect(SectionSpecSchema.safeParse(makeSection('hero', 0)).success).toBe(true);
  });

  it('rejects empty id', () => {
    expect(SectionSpecSchema.safeParse({ ...makeSection('hero', 0), id: '' }).success).toBe(false);
  });

  it('rejects negative order', () => {
    expect(SectionSpecSchema.safeParse({ ...makeSection('hero', -1) }).success).toBe(false);
  });

  it('rejects fractional order', () => {
    expect(SectionSpecSchema.safeParse({ ...makeSection('hero', 0), order: 1.5 }).success).toBe(false);
  });

  it('rejects unknown density value', () => {
    expect(SectionSpecSchema.safeParse({ ...makeSection('hero', 0), density: 'normal' }).success).toBe(false);
  });

  it('rejects missing visible field', () => {
    const { visible: _, ...rest } = makeSection('hero', 0);
    expect(SectionSpecSchema.safeParse(rest).success).toBe(false);
  });
});

describe('CompositionSpecSchema - shape invariants', () => {
  it('accepts a spec with one section', () => {
    expect(CompositionSpecSchema.safeParse(twoSection).success).toBe(true);
  });

  it('rejects an empty sections array', () => {
    expect(CompositionSpecSchema.safeParse({ sections: [] }).success).toBe(false);
  });

  it('rejects when sections contains an invalid section', () => {
    const bad = { sections: [{ id: '', visible: true, density: 'regular', order: 0 }] };
    expect(CompositionSpecSchema.safeParse(bad).success).toBe(false);
  });
});

describe('encodeComposition / decodeComposition - round-trip', () => {
  it('decoding encoded spec returns a spec equal to the original', () => {
    const encoded = encodeComposition(threeSection);
    expect(decodeComposition(encoded)).toEqual(threeSection);
  });

  it('encoded value is a non-empty string', () => {
    expect(typeof encodeComposition(twoSection)).toBe('string');
    expect(encodeComposition(twoSection).length).toBeGreaterThan(0);
  });

  it('two identical specs encode to the same string', () => {
    const a = encodeComposition(twoSection);
    const b = encodeComposition(JSON.parse(JSON.stringify(twoSection)) as CompositionSpec);
    expect(a).toBe(b);
  });

  it('two distinct specs encode to different strings', () => {
    expect(encodeComposition(twoSection)).not.toBe(encodeComposition(threeSection));
  });
});

describe('decodeComposition - invalid inputs', () => {
  it('returns null for a non-base64 string', () => {
    expect(decodeComposition('not-valid-base64!!!')).toBeNull();
  });

  it('returns null for valid base64 that is not JSON', () => {
    expect(decodeComposition(btoa('not-json'))).toBeNull();
  });

  it('returns null for valid JSON that fails schema validation', () => {
    expect(decodeComposition(btoa(JSON.stringify({ sections: [] })))).toBeNull();
  });

  it('returns null for valid JSON with missing required section fields', () => {
    const bad = { sections: [{ id: 'x' }] };
    expect(decodeComposition(btoa(JSON.stringify(bad)))).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(decodeComposition('')).toBeNull();
  });
});

describe('compositionToHash / compositionFromHash - round-trip', () => {
  it('round-trip produces a spec equal to the original', () => {
    const hash = compositionToHash(threeSection);
    expect(compositionFromHash(hash)).toEqual(threeSection);
  });

  it('toHash output starts with "#"', () => {
    expect(compositionToHash(twoSection).startsWith('#')).toBe(true);
  });

  it('toHash output contains the key "composition="', () => {
    expect(compositionToHash(twoSection)).toContain('composition=');
  });

  it('fromHash handles hash string without leading "#"', () => {
    const hash = compositionToHash(twoSection).slice(1);
    expect(compositionFromHash(hash)).toEqual(twoSection);
  });

  it('fromHash returns null when composition key is absent', () => {
    expect(compositionFromHash('#other=value')).toBeNull();
    expect(compositionFromHash('')).toBeNull();
  });

  it('fromHash returns null when the encoded value is corrupted', () => {
    expect(compositionFromHash('#composition=!!!invalid!!!')).toBeNull();
  });

  it('fromHash returns null when composition key is present with empty value', () => {
    expect(compositionFromHash('#composition=')).toBeNull();
  });

  it.each(['compact', 'regular', 'spacious'] as const)(
    'density "%s" survives compositionToHash → compositionFromHash without loss',
    (density) => {
      const updated = updateSection(threeSection, 'hero', { density });
      const decoded = compositionFromHash(compositionToHash(updated));
      expect(decoded?.sections.find((s) => s.id === 'hero')?.density).toBe(density);
    },
  );

  it('each of the three density values produces a distinct hash for the same base spec', () => {
    const hashes = (['compact', 'regular', 'spacious'] as const).map(
      (d) => compositionToHash(updateSection(threeSection, 'hero', { density: d })),
    );
    expect(new Set(hashes).size).toBe(3);
  });
});

describe('sectionsByOrder - sort behavior', () => {
  it('returns sections in ascending order when input is reversed', () => {
    const sorted = sectionsByOrder(reversedOrder);
    expect(sorted.map((s) => s.id)).toEqual(['hero', 'features', 'footer']);
  });

  it('already-sorted input comes out in the same order', () => {
    const sorted = sectionsByOrder(threeSection);
    expect(sorted.map((s) => s.id)).toEqual(['hero', 'features', 'footer']);
  });

  it('result length equals input sections length', () => {
    expect(sectionsByOrder(threeSection)).toHaveLength(threeSection.sections.length);
  });

  it('does not mutate the original spec sections array', () => {
    const original = [...reversedOrder.sections];
    sectionsByOrder(reversedOrder);
    expect(reversedOrder.sections).toEqual(original);
  });

  it('single section stays single', () => {
    const single: CompositionSpec = { sections: [makeSection('only', 0)] };
    expect(sectionsByOrder(single)).toHaveLength(1);
  });
});

describe('visibleSections - filtering and ordering', () => {
  it('returns all sections when all are visible, sorted by order', () => {
    const result = visibleSections(reversedOrder);
    expect(result.map((s) => s.id)).toEqual(['hero', 'features', 'footer']);
  });

  it('returns empty array when all sections are hidden', () => {
    const allHidden: CompositionSpec = {
      sections: threeSection.sections.map((s) => ({ ...s, visible: false })),
    };
    expect(visibleSections(allHidden)).toHaveLength(0);
  });

  it('returns only visible sections, sorted by order', () => {
    const mixed: CompositionSpec = {
      sections: [
        makeSection('hero', 0, false),
        makeSection('features', 1, true),
        makeSection('footer', 2, false),
      ],
    };
    const result = visibleSections(mixed);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('features');
  });

  it('does not mutate the original spec', () => {
    const original = threeSection.sections.map((s) => ({ ...s }));
    visibleSections(threeSection);
    expect(threeSection.sections).toEqual(original);
  });
});

describe('updateSection - patch semantics', () => {
  it('patching visible=false hides the target section', () => {
    const updated = updateSection(threeSection, 'hero', { visible: false });
    const heroSection = updated.sections.find((s) => s.id === 'hero');
    expect(heroSection!.visible).toBe(false);
  });

  it('patching density changes only the target section', () => {
    const updated = updateSection(threeSection, 'features', { density: 'compact' });
    expect(updated.sections.find((s) => s.id === 'features')!.density).toBe('compact');
    expect(updated.sections.find((s) => s.id === 'hero')!.density).toBe('regular');
  });

  it('unknown id leaves all sections unchanged', () => {
    const updated = updateSection(threeSection, 'nonexistent', { visible: false });
    expect(updated.sections).toEqual(threeSection.sections);
  });

  it('returns a new spec object (does not mutate)', () => {
    const updated = updateSection(threeSection, 'hero', { visible: false });
    expect(updated).not.toBe(threeSection);
    expect(threeSection.sections.find((s) => s.id === 'hero')!.visible).toBe(true);
  });

  it('preserves all unpatched sections unchanged', () => {
    const updated = updateSection(threeSection, 'hero', { visible: false });
    expect(updated.sections.filter((s) => s.id !== 'hero')).toEqual(
      threeSection.sections.filter((s) => s.id !== 'hero'),
    );
  });

  it('patching both visible and density simultaneously applies both changes', () => {
    const updated = updateSection(threeSection, 'hero', { visible: false, density: 'compact' });
    const hero = updated.sections.find((s) => s.id === 'hero')!;
    expect(hero.visible).toBe(false);
    expect(hero.density).toBe('compact');
  });
});

describe('reorderSections - order reassignment', () => {
  it('moving from index 0 to last position shifts all sections', () => {
    const reordered = reorderSections(threeSection, 0, 2);
    const sorted = sectionsByOrder(reordered);
    expect(sorted[0]!.id).toBe('features');
    expect(sorted[1]!.id).toBe('footer');
    expect(sorted[2]!.id).toBe('hero');
  });

  it('moving from last index to first shifts all sections', () => {
    const reordered = reorderSections(threeSection, 2, 0);
    const sorted = sectionsByOrder(reordered);
    expect(sorted[0]!.id).toBe('footer');
    expect(sorted[1]!.id).toBe('hero');
    expect(sorted[2]!.id).toBe('features');
  });

  it('after any reorder, orders form a contiguous 0..n-1 sequence', () => {
    const reordered = reorderSections(threeSection, 0, 2);
    const sorted = sectionsByOrder(reordered);
    for (let i = 0; i < sorted.length; i++) {
      expect(sorted[i]!.order).toBe(i);
    }
  });

  it('moving to the same position leaves section order unchanged', () => {
    const reordered = reorderSections(threeSection, 1, 1);
    expect(sectionsByOrder(reordered).map((s) => s.id)).toEqual(
      sectionsByOrder(threeSection).map((s) => s.id),
    );
  });

  it('returns a new spec object (does not mutate original)', () => {
    const original = JSON.stringify(threeSection);
    reorderSections(threeSection, 0, 2);
    expect(JSON.stringify(threeSection)).toBe(original);
  });

  it('section count is preserved after reorder', () => {
    const reordered = reorderSections(threeSection, 0, 2);
    expect(reordered.sections).toHaveLength(threeSection.sections.length);
  });

  it('two-section swap produces reversed order', () => {
    const two: CompositionSpec = { sections: [makeSection('first', 0), makeSection('second', 1)] };
    const reordered = reorderSections(two, 0, 1);
    const sorted = sectionsByOrder(reordered);
    expect(sorted[0]!.id).toBe('second');
    expect(sorted[1]!.id).toBe('first');
  });

  it('two-section swap preserves contiguous 0..1 order sequence', () => {
    const two: CompositionSpec = { sections: [makeSection('a', 0), makeSection('b', 1)] };
    const reordered = reorderSections(two, 0, 1);
    const sorted = sectionsByOrder(reordered);
    expect(sorted[0]!.order).toBe(0);
    expect(sorted[1]!.order).toBe(1);
  });
});
