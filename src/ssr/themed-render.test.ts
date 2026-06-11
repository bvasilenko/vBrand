// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { describe, it, expect } from 'vitest';
import React from 'react';
import type { VbrandType } from '../schema.js';
import { getThemedRenderHTML } from './themed-render.js';

const ASSETS = { favicon: { source: 'x', sizes: [32] }, og: { dimensions: [1200, 630] as [number, number] }, icons: { source: 'x', set: [] } };

const NO_TOKENS_BRAND: VbrandType = {
  name: 'Empty', sources: [],
  voice: { canonical: '', repoDescription: '' },
  assets: ASSETS,
  tokens: { color: {}, type: {} },
};

const COLOR_ONLY_BRAND: VbrandType = {
  ...NO_TOKENS_BRAND,
  tokens: { color: { primary: '#635BFF', secondary: '#0A2540' }, type: {} },
};

const TYPE_ONLY_BRAND: VbrandType = {
  ...NO_TOKENS_BRAND,
  tokens: { color: {}, type: { body: 'Inter, sans-serif', heading: 'Playfair Display, serif' } },
};

const ALL_TOKENS_BRAND: VbrandType = {
  ...NO_TOKENS_BRAND,
  tokens: {
    color: { primary: '#635BFF', secondary: '#0A2540' },
    type: { body: 'Inter, sans-serif', heading: 'Playfair Display, serif' },
  },
};

const section = (): React.ReactElement =>
  React.createElement('main', null, React.createElement('p', null, 'hello'));

function extractTokenBlock(html: string): string {
  const lastStyleStart = html.lastIndexOf('<style>');
  const lastStyleEnd = html.lastIndexOf('</style>');
  if (lastStyleStart === html.indexOf('<style>')) return '';
  return html.slice(lastStyleStart + '<style>'.length, lastStyleEnd);
}

describe('getThemedRenderHTML: document structure', () => {
  it('returns a string starting with <!doctype html>', () => {
    const html = getThemedRenderHTML(NO_TOKENS_BRAND, [section()]);
    expect(html).toMatch(/^<!doctype html>/i);
  });

  it('wraps content in <html lang="en"><head>...</head><body>...</body></html>', () => {
    const html = getThemedRenderHTML(NO_TOKENS_BRAND, [section()]);
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<head>');
    expect(html).toContain('</head>');
    expect(html).toContain('<body>');
    expect(html).toContain('</body>');
    expect(html).toContain('</html>');
  });

  it('includes charset meta tag', () => {
    expect(getThemedRenderHTML(NO_TOKENS_BRAND, [section()])).toContain('<meta charset="utf-8">');
  });

  it('includes viewport meta tag', () => {
    expect(getThemedRenderHTML(NO_TOKENS_BRAND, [section()])).toContain('<meta name="viewport"');
  });

  it('renders section element content inside <body>', () => {
    const html = getThemedRenderHTML(NO_TOKENS_BRAND, [section()]);
    expect(html).toContain('<main><p>hello</p></main>');
  });

  it('two calls with identical arguments return byte-identical strings', () => {
    const a = getThemedRenderHTML(COLOR_ONLY_BRAND, [section()]);
    const b = getThemedRenderHTML(COLOR_ONLY_BRAND, [section()]);
    expect(a).toBe(b);
  });
});

describe('getThemedRenderHTML: Tailwind CSS bundle', () => {
  it('includes a non-empty <style> block', () => {
    const html = getThemedRenderHTML(NO_TOKENS_BRAND, [section()]);
    expect(html).toMatch(/<style>.{100,}<\/style>/s);
  });

  it('the Tailwind style block appears before </head>', () => {
    const html = getThemedRenderHTML(NO_TOKENS_BRAND, [section()]);
    const styleEnd = html.indexOf('</style>');
    const headEnd = html.indexOf('</head>');
    expect(styleEnd).toBeGreaterThan(0);
    expect(styleEnd).toBeLessThan(headEnd);
  });
});

describe('getThemedRenderHTML: brand token injection - presence', () => {
  it('does not inject a brand token style block when both color and type tokens are empty', () => {
    const html = getThemedRenderHTML(NO_TOKENS_BRAND, [section()]);
    expect((html.match(/<style>/g) ?? []).length).toBe(1);
  });

  it('injects a brand token style block when only color tokens are present', () => {
    const html = getThemedRenderHTML(COLOR_ONLY_BRAND, [section()]);
    expect((html.match(/<style>/g) ?? []).length).toBe(2);
  });

  it('injects a brand token style block when only type tokens are present', () => {
    const html = getThemedRenderHTML(TYPE_ONLY_BRAND, [section()]);
    expect((html.match(/<style>/g) ?? []).length).toBe(2);
  });

  it('injects a single brand token style block when both color and type tokens are present', () => {
    const html = getThemedRenderHTML(ALL_TOKENS_BRAND, [section()]);
    expect((html.match(/<style>/g) ?? []).length).toBe(2);
  });

  it('brand token style block appears after the Tailwind bundle style block', () => {
    const html = getThemedRenderHTML(COLOR_ONLY_BRAND, [section()]);
    const firstStyleIdx = html.indexOf('<style>');
    const lastStyleIdx = html.lastIndexOf('<style>');
    expect(lastStyleIdx).toBeGreaterThan(firstStyleIdx);
    expect(html.slice(lastStyleIdx)).toContain(':root');
  });

  it('excludes a token whose value is an empty string from the injected block', () => {
    const brand = { ...NO_TOKENS_BRAND, tokens: { color: { primary: '' }, type: {} } } as VbrandType;
    const html = getThemedRenderHTML(brand, [section()]);
    expect((html.match(/<style>/g) ?? []).length).toBe(1);
    expect(html).not.toContain('--color-primary');
  });
});

describe('getThemedRenderHTML: brand token injection - format', () => {
  it('wraps all brand CSS vars in a single :root{} block', () => {
    const html = getThemedRenderHTML(COLOR_ONLY_BRAND, [section()]);
    expect(html).toMatch(/<style>:root\{[^}]+\}<\/style>/);
  });

  it('color token primary maps to --color-primary', () => {
    const html = getThemedRenderHTML(COLOR_ONLY_BRAND, [section()]);
    expect(html).toContain('--color-primary:#635BFF');
  });

  it('color token secondary maps to --color-secondary', () => {
    const html = getThemedRenderHTML(COLOR_ONLY_BRAND, [section()]);
    expect(html).toContain('--color-secondary:#0A2540');
  });

  it('type token body maps to --font-body', () => {
    const html = getThemedRenderHTML(TYPE_ONLY_BRAND, [section()]);
    expect(html).toContain('--font-body:Inter, sans-serif');
  });

  it('type token heading maps to --font-heading', () => {
    const html = getThemedRenderHTML(TYPE_ONLY_BRAND, [section()]);
    expect(html).toContain('--font-heading:Playfair Display, serif');
  });

  it('CSS var value containing spaces and commas is preserved verbatim', () => {
    const html = getThemedRenderHTML(TYPE_ONLY_BRAND, [section()]);
    expect(html).toContain('Inter, sans-serif');
  });

  it('all brand token CSS vars in the injected block follow the --{category}-{key} naming pattern', () => {
    const html = getThemedRenderHTML(ALL_TOKENS_BRAND, [section()]);
    const tokenBlock = extractTokenBlock(html);
    expect(tokenBlock.length).toBeGreaterThan(0);
    const varNames = tokenBlock.match(/--[\w-]+(?=:)/g) ?? [];
    expect(varNames.length).toBeGreaterThan(0);
    for (const name of varNames) {
      expect(name).toMatch(/^--[a-z]+-[a-z]/);
    }
  });

  it('no brand token CSS var name uses the vtheme --v- prefix', () => {
    const html = getThemedRenderHTML(ALL_TOKENS_BRAND, [section()]);
    const tokenBlock = extractTokenBlock(html);
    expect(tokenBlock).not.toMatch(/--v-/);
  });

  it('all four token vars are present in a single :root block when all tokens are provided', () => {
    const html = getThemedRenderHTML(ALL_TOKENS_BRAND, [section()]);
    const tokenBlock = extractTokenBlock(html);
    expect(tokenBlock).toContain('--color-primary');
    expect(tokenBlock).toContain('--color-secondary');
    expect(tokenBlock).toContain('--font-body');
    expect(tokenBlock).toContain('--font-heading');
  });
});

describe('getThemedRenderHTML: section composition', () => {
  it('concatenates multiple sections into body in declaration order', () => {
    const html = getThemedRenderHTML(NO_TOKENS_BRAND, [
      React.createElement('header', null, 'A'),
      React.createElement('footer', null, 'B'),
    ]);
    const body = html.match(/<body>(.*?)<\/body>/s)?.[1] ?? '';
    expect(body.indexOf('<header>')).toBeLessThan(body.indexOf('<footer>'));
  });

  it('renders a single section into body', () => {
    const html = getThemedRenderHTML(NO_TOKENS_BRAND, [React.createElement('article', null, 'solo')]);
    expect(html).toContain('<article>solo</article>');
  });

  it('produces an empty <body> when sections array is empty', () => {
    expect(getThemedRenderHTML(NO_TOKENS_BRAND, [])).toContain('<body></body>');
  });

  it('null in sections array does not throw', () => {
    expect(() => getThemedRenderHTML(NO_TOKENS_BRAND, [null])).not.toThrow();
  });

  it('deeply nested section structure is rendered correctly', () => {
    const deep = React.createElement('section', null,
      React.createElement('article', null,
        React.createElement('p', null, React.createElement('strong', null, 'deep')),
      ),
    );
    const html = getThemedRenderHTML(NO_TOKENS_BRAND, [deep]);
    expect(html).toContain('<strong>deep</strong>');
  });

  it('undefined in sections array does not throw', () => {
    expect(() => getThemedRenderHTML(NO_TOKENS_BRAND, [undefined])).not.toThrow();
  });
});
