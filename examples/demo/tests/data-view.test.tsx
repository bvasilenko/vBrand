// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { VbrandType } from '@booga/vbrand/adapters/browser';
import { DataView } from '../src/data-view.js';
import type { BrandMeta } from '../src/brand-loader.js';

const MINIMAL_BRAND: VbrandType = {
  name: 'TestCo',
  voice: { canonical: 'TestCo brand voice.', repoDescription: 'TestCo on GitHub.' },
  assets: {
    favicon: { source: 'https://testco.com/favicon.ico', sizes: [32] },
    og: { dimensions: [1200, 630] },
    icons: { source: 'https://testco.com/icon.svg', set: [] },
  },
  tokens: { color: { primary: '#ff0000' }, type: { body: 'Inter' } },
  sources: ['test:testco'],
};

const META_CLEAN: BrandMeta = {
  colorFallbackActive: false,
  faviconBundled: false,
  githubColorFallback: false,
};

const META_GITHUB_FALLBACK: BrandMeta = {
  colorFallbackActive: true,
  faviconBundled: false,
  githubColorFallback: true,
};

const META_GENERIC_FALLBACK: BrandMeta = {
  colorFallbackActive: true,
  faviconBundled: false,
  githubColorFallback: false,
};

const META_GITHUB_FLAG_ONLY: BrandMeta = {
  colorFallbackActive: false,
  faviconBundled: false,
  githubColorFallback: true,
};

const GITHUB_PILL_TEXT = 'GitHub source: no brand color derived; using fallback';
const GENERIC_PILL_TEXT = 'color fallback active';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function renderDataView(meta: BrandMeta, sourceLabel = 'test'): void {
  act(() => root.render(React.createElement(DataView, { brand: MINIMAL_BRAND, sourceLabel, meta })));
}

function containerText(): string {
  return container.textContent ?? '';
}

describe('DataView: color-status pill display', () => {
  it('shows no color-fallback pill when all meta flags are false', () => {
    renderDataView(META_CLEAN);
    expect(containerText()).not.toContain(GITHUB_PILL_TEXT);
    expect(containerText()).not.toContain(GENERIC_PILL_TEXT);
  });

  it('shows the GitHub-specific pill when githubColorFallback is true', () => {
    renderDataView(META_GITHUB_FALLBACK);
    expect(containerText()).toContain(GITHUB_PILL_TEXT);
  });

  it('shows the generic pill when colorFallbackActive is true and githubColorFallback is false', () => {
    renderDataView(META_GENERIC_FALLBACK);
    expect(containerText()).toContain(GENERIC_PILL_TEXT);
  });

  it('does not show the generic pill when githubColorFallback is true', () => {
    renderDataView(META_GITHUB_FALLBACK);
    expect(containerText()).not.toContain(GENERIC_PILL_TEXT);
  });

  it('does not show the GitHub pill when githubColorFallback is false', () => {
    renderDataView(META_GENERIC_FALLBACK);
    expect(containerText()).not.toContain(GITHUB_PILL_TEXT);
  });

  it('shows the GitHub pill even when colorFallbackActive is false (githubColorFallback is independent)', () => {
    renderDataView(META_GITHUB_FLAG_ONLY);
    expect(containerText()).toContain(GITHUB_PILL_TEXT);
    expect(containerText()).not.toContain(GENERIC_PILL_TEXT);
  });

  it('shows exactly one of the two pills when githubColorFallback and colorFallbackActive are both true', () => {
    renderDataView(META_GITHUB_FALLBACK);
    const githubCount = (containerText().match(new RegExp(GITHUB_PILL_TEXT, 'g')) ?? []).length;
    const genericCount = (containerText().match(new RegExp(GENERIC_PILL_TEXT, 'g')) ?? []).length;
    expect(githubCount).toBe(1);
    expect(genericCount).toBe(0);
  });
});

describe('DataView: source label pill', () => {
  it('renders the sourceLabel inside the source pill text', () => {
    renderDataView(META_CLEAN, 'fixture:stripe');
    expect(containerText()).toContain('fixture:stripe');
  });

  it('renders different sourceLabel values without contamination', () => {
    renderDataView(META_CLEAN, 'github:acme/widget');
    expect(containerText()).toContain('github:acme/widget');
  });
});

describe('DataView: token count display', () => {
  it('reports the correct number of color tokens for the brand', () => {
    const colorCount = Object.keys(MINIMAL_BRAND.tokens.color).length;
    renderDataView(META_CLEAN);
    expect(containerText()).toContain(`${colorCount} color tokens`);
  });

  it('reports the correct number of type tokens for the brand', () => {
    const typeCount = Object.keys(MINIMAL_BRAND.tokens.type).length;
    renderDataView(META_CLEAN);
    expect(containerText()).toContain(`${typeCount} type tokens`);
  });
});

describe('DataView: schema validity pill', () => {
  it('always renders the "VbrandSchema valid" pill for a valid brand', () => {
    renderDataView(META_CLEAN);
    expect(containerText()).toContain('VbrandSchema valid');
  });
});
