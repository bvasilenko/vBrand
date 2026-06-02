// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { describe, it, expect, beforeAll } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';
import { loadFromFixtureHandle } from '../../../src/adapters/brand-source/fixture-loader.js';
import { getTemplate } from '../../../src/templates/registry.js';
import {
  compositionFromHash,
  compositionToHash,
  reorderSections,
  updateSection,
} from '../../../src/composition/spec.js';
import type { CompositionSpec } from '../../../src/composition/spec.js';

const template = getTemplate('landing');
let brand: Awaited<ReturnType<typeof loadFromFixtureHandle>>;
beforeAll(async () => { brand = await loadFromFixtureHandle('stripe'); });

function render(spec: CompositionSpec): string {
  return renderToString(
    React.createElement(React.Fragment, null, template.compose(brand, spec)),
  );
}

const allVisible = template.defaultComposition();

const heroHidden: CompositionSpec = {
  sections: allVisible.sections.map((s) => ({ ...s, visible: s.id !== 'hero' })),
};

const reordered: CompositionSpec = reorderSections(
  { sections: allVisible.sections.map((s) => ({ ...s, density: s.id === 'hero' ? 'compact' as const : 'spacious' as const })) },
  0,
  3,
);

describe('landing template: composition probe - 3 distinct compositions', () => {
  it('composition 1 (all visible): renders without error', () => {
    expect(() => render(allVisible)).not.toThrow();
  });

  it('composition 1 (all visible): produces non-empty HTML', () => {
    expect(render(allVisible).length).toBeGreaterThan(100);
  });

  it('composition 2 (hero hidden): renders without error', () => {
    expect(() => render(heroHidden)).not.toThrow();
  });

  it('composition 2 (hero hidden): produces shorter HTML than all-visible', () => {
    expect(render(heroHidden).length).toBeLessThan(render(allVisible).length);
  });

  it('composition 3 (reordered + density mixed): renders without error', () => {
    expect(() => render(reordered)).not.toThrow();
  });

  it('composition 3 (reordered + density mixed): output differs from all-visible', () => {
    expect(render(reordered)).not.toBe(render(allVisible));
  });
});

describe('landing template: composition hash round-trip', () => {
  it('encodeComposition + decodeComposition is lossless', () => {
    const hash = compositionToHash(allVisible);
    const decoded = compositionFromHash(hash);
    expect(decoded).not.toBeNull();
    expect(decoded!.sections.length).toBe(allVisible.sections.length);
    decoded!.sections.forEach((s, i) => {
      const orig = allVisible.sections.find((o) => o.id === s.id)!;
      expect(s.visible).toBe(orig.visible);
      expect(s.density).toBe(orig.density);
      expect(s.order).toBe(orig.order);
    });
  });

  it('round-tripped composition renders identically to the original', () => {
    const hash = compositionToHash(heroHidden);
    const decoded = compositionFromHash(hash)!;
    expect(render(decoded)).toBe(render(heroHidden));
  });

  it('compositionFromHash returns null for an empty hash', () => {
    expect(compositionFromHash('')).toBeNull();
    expect(compositionFromHash('#')).toBeNull();
  });

  it('compositionFromHash returns null for a malformed hash', () => {
    expect(compositionFromHash('#composition=not-valid-base64!!!')).toBeNull();
  });
});

describe('landing template: updateSection contract in rendering context', () => {
  it('toggling a section off reduces rendered HTML length', () => {
    const withFeaturesHidden = updateSection(allVisible, 'features', { visible: false });
    expect(render(withFeaturesHidden).length).toBeLessThan(render(allVisible).length);
  });

  it('changing density produces different rendered output', () => {
    const compact = updateSection(allVisible, 'hero', { density: 'compact' });
    const spacious = updateSection(allVisible, 'hero', { density: 'spacious' });
    expect(render(compact)).not.toBe(render(spacious));
  });
});
