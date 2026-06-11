// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { describe, it, expect } from 'vitest';
import React from 'react';
import type { VbrandType } from '../../../src/adapters/brand-source/types.js';
import { buildIframeSrcDoc } from '../src/iframe-srcdoc.js';
import { getThemedRenderHTML } from '@booga/vbrand/ssr';

const BRAND: VbrandType = {
  name: 'Stripe',
  voice: { canonical: 'Stripe', repoDescription: 'Stripe' },
  assets: {
    favicon: { source: 'https://stripe.com/favicon.ico', sizes: [32] },
    og: { dimensions: [1200, 630] },
    icons: { source: 'https://stripe.com/favicon.ico', set: [] },
  },
  tokens: {
    color: { primary: '#635BFF', secondary: '#0A2540' },
    type: { body: 'Inter, sans-serif', heading: 'Inter Display, sans-serif' },
  },
  sources: ['fixture:stripe'],
};

const EMPTY_BRAND: VbrandType = {
  ...BRAND,
  tokens: { color: {}, type: {} },
};

const sections = (): React.ReactElement[] => [React.createElement('p', null, 'test')];

describe('buildIframeSrcDoc - delegation contract', () => {
  it('returns the exact same string as getThemedRenderHTML called with the same arguments', () => {
    expect(buildIframeSrcDoc(BRAND, sections())).toBe(getThemedRenderHTML(BRAND, sections()));
  });

  it('returns the same string as getThemedRenderHTML when brand has no tokens', () => {
    expect(buildIframeSrcDoc(EMPTY_BRAND, sections())).toBe(getThemedRenderHTML(EMPTY_BRAND, sections()));
  });

  it('returns the same string as getThemedRenderHTML with multiple sections', () => {
    const secs = [
      React.createElement('header', null, 'A'),
      React.createElement('footer', null, 'B'),
    ];
    expect(buildIframeSrcDoc(BRAND, secs)).toBe(getThemedRenderHTML(BRAND, secs));
  });

  it('returns the same string as getThemedRenderHTML with empty sections', () => {
    expect(buildIframeSrcDoc(BRAND, [])).toBe(getThemedRenderHTML(BRAND, []));
  });
});

describe('buildIframeSrcDoc - output sanity', () => {
  it('returns a full HTML document string', () => {
    expect(buildIframeSrcDoc(BRAND, sections())).toMatch(/^<!doctype html>/i);
  });

  it('brand primary color token appears in the output', () => {
    expect(buildIframeSrcDoc(BRAND, sections())).toContain('--color-primary:#635BFF');
  });

  it('section content appears in the output body', () => {
    const result = buildIframeSrcDoc(BRAND, [React.createElement('section', null, 'hello')]);
    expect(result).toContain('<section>hello</section>');
  });
});
