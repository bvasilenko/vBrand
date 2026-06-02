// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';
import { fixtures } from '@booga/vfixtures';
import {
  TEMPLATE_IDS,
  TEMPLATE_REGISTRY,
  getTemplate,
  isTemplateId,
  compositionMatchesTemplate,
} from './registry.js';
import type { VbrandType } from '../schema.js';
import type { CompositionSpec } from '../composition/spec.js';

const FIXTURE_SLUGS = ['stripe', 'vercel', 'linear', 'notion', 'github'] as const;
function render(templateId: typeof TEMPLATE_IDS[number], brand: VbrandType, comp: CompositionSpec) {
  return renderToString(
    React.createElement(React.Fragment, null, getTemplate(templateId).compose(brand, comp)),
  );
}

describe('AppTypeTemplate registry - interface compliance', () => {
  for (const id of TEMPLATE_IDS) {
    it(`${id} template: templateId() returns "${id}"`, () => {
      expect(TEMPLATE_REGISTRY[id].templateId()).toBe(id);
    });

    it(`${id} template: defaultComposition returns at least one section`, () => {
      expect(getTemplate(id).defaultComposition().sections.length).toBeGreaterThan(0);
    });

    it(`${id} template: defaultComposition section ids are unique`, () => {
      const ids = getTemplate(id).defaultComposition().sections.map((s) => s.id);
      expect(ids.length).toBe(new Set(ids).size);
    });

    it(`${id} template: defaultComposition section orders are a contiguous 0..n-1 sequence`, () => {
      const orders = getTemplate(id)
        .defaultComposition()
        .sections.map((s) => s.order)
        .sort((a, b) => a - b);
      for (let i = 0; i < orders.length; i++) {
        expect(orders[i]).toBe(i);
      }
    });

    it(`${id} template: every section has a valid density value`, () => {
      const validDensities = ['compact', 'regular', 'spacious'];
      for (const s of getTemplate(id).defaultComposition().sections) {
        expect(validDensities).toContain(s.density);
      }
    });
  }
});

describe('AppTypeTemplate registry - renders against Stripe fixture', () => {
  for (const id of TEMPLATE_IDS) {
    it(`${id} template: compose does not throw against Stripe fixture`, () => {
      const template = getTemplate(id);
      const comp = template.defaultComposition();
      expect(() => render(id, fixtures.stripe, comp)).not.toThrow();
    });

    it(`${id} template: compose produces non-empty HTML against Stripe fixture`, () => {
      const template = getTemplate(id);
      const comp = template.defaultComposition();
      expect(render(id, fixtures.stripe, comp).length).toBeGreaterThan(0);
    });
  }
});

describe('AppTypeTemplate registry - renders across all fixtures', () => {
  for (const slug of FIXTURE_SLUGS) {
    it(`landing template: renders without error for "${slug}" fixture`, () => {
      const template = getTemplate('landing');
      const comp = template.defaultComposition();
      expect(() => render('landing', fixtures[slug], comp)).not.toThrow();
    });
  }

  for (const id of TEMPLATE_IDS) {
    it(`${id} template: renders without error for all fixtures`, () => {
      const template = getTemplate(id);
      const comp = template.defaultComposition();
      for (const slug of FIXTURE_SLUGS) {
        expect(
          () => render(id, fixtures[slug], comp),
          `${id} threw on fixture "${slug}"`,
        ).not.toThrow();
      }
    });
  }
});

describe('AppTypeTemplate registry - composition filtering', () => {
  for (const id of TEMPLATE_IDS) {
    it(`${id} template: renders without error when all sections are hidden`, () => {
      const template = getTemplate(id);
      const allHidden: CompositionSpec = {
        sections: template.defaultComposition().sections.map((s) => ({ ...s, visible: false })),
      };
      expect(() => render(id, fixtures.stripe, allHidden)).not.toThrow();
    });

    it(`${id} template: renders without error with a single visible section`, () => {
      const template = getTemplate(id);
      const firstId = template.defaultComposition().sections[0]!.id;
      const singleVisible: CompositionSpec = {
        sections: template.defaultComposition().sections.map((s) => ({
          ...s,
          visible: s.id === firstId,
        })),
      };
      expect(() => render(id, fixtures.stripe, singleVisible)).not.toThrow();
    });

    it(`${id} template: all-sections-visible output is longer than all-sections-hidden output`, () => {
      const template = getTemplate(id);
      const allVisible = template.defaultComposition();
      const allHidden: CompositionSpec = {
        sections: allVisible.sections.map((s) => ({ ...s, visible: false })),
      };
      const fullHtml = render(id, fixtures.stripe, allVisible);
      const emptyHtml = render(id, fixtures.stripe, allHidden);
      expect(fullHtml.length).toBeGreaterThan(emptyHtml.length);
    });
  }

  it('landing: hiding one section produces output shorter than all-visible', () => {
    const template = getTemplate('landing');
    const comp = template.defaultComposition();
    const withHiddenHero: CompositionSpec = {
      sections: comp.sections.map((s) => ({ ...s, visible: s.id !== 'hero' })),
    };
    const fullHtml = render('landing', fixtures.stripe, comp);
    const partialHtml = render('landing', fixtures.stripe, withHiddenHero);
    expect(partialHtml.length).toBeLessThan(fullHtml.length);
  });
});

describe('AppTypeTemplate registry - section vocabulary isolation', () => {
  for (const fromId of TEMPLATE_IDS) {
    for (const toId of TEMPLATE_IDS) {
      if (fromId === toId) continue;
      it(`${toId}: compose() with ${fromId} sections produces less output than with own sections`, () => {
        const withForeign = render(toId, fixtures.stripe, getTemplate(fromId).defaultComposition());
        const withOwn = render(toId, fixtures.stripe, getTemplate(toId).defaultComposition());
        expect(withForeign.length).toBeLessThan(withOwn.length);
      });
    }
  }
});

describe('AppTypeTemplate registry - registry accessor contract', () => {
  it('isTemplateId accepts all registered template ids', () => {
    for (const id of TEMPLATE_IDS) {
      expect(isTemplateId(id)).toBe(true);
    }
  });

  it('isTemplateId rejects unknown strings', () => {
    expect(isTemplateId('not-a-template')).toBe(false);
    expect(isTemplateId('')).toBe(false);
  });

  it('getTemplate returns the same object as TEMPLATE_REGISTRY lookup', () => {
    for (const id of TEMPLATE_IDS) {
      expect(getTemplate(id)).toBe(TEMPLATE_REGISTRY[id]);
    }
  });

  it('TEMPLATE_IDS contains no duplicate entries', () => {
    expect(TEMPLATE_IDS.length).toBe(new Set(TEMPLATE_IDS).size);
  });
});

describe('compositionMatchesTemplate: degenerate inputs', () => {
  it('null returns false regardless of template', () => {
    for (const id of TEMPLATE_IDS) {
      expect(compositionMatchesTemplate(null, id)).toBe(false);
    }
  });

  it('empty sections array returns false', () => {
    expect(compositionMatchesTemplate({ sections: [] as CompositionSpec['sections'] }, 'landing')).toBe(false);
  });
});

describe('compositionMatchesTemplate: exact section ID set equality', () => {
  for (const id of TEMPLATE_IDS) {
    it(`${id}: own defaultComposition returns true`, () => {
      expect(compositionMatchesTemplate(getTemplate(id).defaultComposition(), id)).toBe(true);
    });
  }

  for (const fromId of TEMPLATE_IDS) {
    for (const toId of TEMPLATE_IDS) {
      if (fromId === toId) continue;
      it(`${fromId} sections do not match ${toId} template`, () => {
        expect(compositionMatchesTemplate(getTemplate(fromId).defaultComposition(), toId)).toBe(false);
      });
    }
  }

  it('composition with only a subset of the required sections returns false', () => {
    const landing = getTemplate('landing').defaultComposition();
    const subset: CompositionSpec = { sections: landing.sections.slice(0, 1) };
    expect(compositionMatchesTemplate(subset, 'landing')).toBe(false);
  });

  it('composition with all required IDs plus an extra ID returns false', () => {
    const landing = getTemplate('landing').defaultComposition();
    const superset: CompositionSpec = {
      sections: [
        ...landing.sections,
        { id: 'extra-panel', visible: true, density: 'regular', order: landing.sections.length },
      ],
    };
    expect(compositionMatchesTemplate(superset, 'landing')).toBe(false);
  });
});

describe('compositionMatchesTemplate: structural validity', () => {
  it('duplicate section IDs return false even when the IDs belong to the template', () => {
    const firstId = getTemplate('landing').defaultComposition().sections[0]!.id;
    const withDuplicates: CompositionSpec = {
      sections: [
        { id: firstId, visible: true, density: 'regular', order: 0 },
        { id: firstId, visible: false, density: 'compact', order: 1 },
      ],
    };
    expect(compositionMatchesTemplate(withDuplicates, 'landing')).toBe(false);
  });

  it('alien section IDs not present in any template return false for every template', () => {
    const alien: CompositionSpec = {
      sections: [{ id: 'alien-section', visible: true, density: 'regular', order: 0 }],
    };
    for (const id of TEMPLATE_IDS) {
      expect(compositionMatchesTemplate(alien, id)).toBe(false);
    }
  });
});

describe('compositionMatchesTemplate: mutable field invariance', () => {
  for (const id of TEMPLATE_IDS) {
    it(`${id}: all-sections-hidden still matches`, () => {
      const allHidden: CompositionSpec = {
        sections: getTemplate(id).defaultComposition().sections.map((s) => ({ ...s, visible: false })),
      };
      expect(compositionMatchesTemplate(allHidden, id)).toBe(true);
    });

    it(`${id}: mixed densities still matches`, () => {
      const densities = ['compact', 'regular', 'spacious'] as const;
      const mixed: CompositionSpec = {
        sections: getTemplate(id).defaultComposition().sections.map((s, i) => ({
          ...s,
          density: densities[i % 3]!,
        })),
      };
      expect(compositionMatchesTemplate(mixed, id)).toBe(true);
    });

    it(`${id}: sections with shuffled order values still matches`, () => {
      const base = getTemplate(id).defaultComposition().sections;
      const shuffled: CompositionSpec = {
        sections: [...base].reverse().map((s, i) => ({ ...s, order: i })),
      };
      expect(compositionMatchesTemplate(shuffled, id)).toBe(true);
    });
  }
});
