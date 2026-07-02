// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { describe, it, expect } from 'vitest';
import { cellToUrl } from './url-builder.mjs';

const BASE_HTTPS = 'https://bvasilenko.github.io';
const BASE_HTTP  = 'http://localhost:5290';
const BASE_WITH_PATH = 'https://example.com/some/extra/path';

function makeCell(overrides = {}) {
  return {
    fixture: 'stripe',
    app:     'landing',
    mode:    'spa',
    stack:   'vite',
    cms:     'vbrand-standalone',
    index:   0,
    ...overrides,
  };
}

describe('cellToUrl - URL validity', () => {
  it('returns a string parseable as a URL', () => {
    expect(() => new URL(cellToUrl(makeCell(), BASE_HTTPS))).not.toThrow();
  });

  it('returns an https:// URL when the base is https', () => {
    expect(cellToUrl(makeCell(), BASE_HTTPS)).toMatch(/^https:\/\//);
  });

  it('returns an http:// URL when the base is http', () => {
    expect(cellToUrl(makeCell(), BASE_HTTP)).toMatch(/^http:\/\//);
  });
});

describe('cellToUrl - path', () => {
  it('path is /vBrand/', () => {
    const url = new URL(cellToUrl(makeCell(), BASE_HTTPS));
    expect(url.pathname).toBe('/vBrand/');
  });

  it('path is always /vBrand/ regardless of any extra path in the base URL', () => {
    const url = new URL(cellToUrl(makeCell(), BASE_WITH_PATH));
    expect(url.pathname).toBe('/vBrand/');
  });

  it('origin is preserved from the base URL', () => {
    const url = new URL(cellToUrl(makeCell(), BASE_HTTPS));
    expect(url.origin).toBe(new URL(BASE_HTTPS).origin);
  });

  it('origin from base URL with extra path is the same origin', () => {
    const url = new URL(cellToUrl(makeCell(), BASE_WITH_PATH));
    expect(url.origin).toBe(new URL(BASE_WITH_PATH).origin);
  });
});

describe('cellToUrl - search params: brand', () => {
  it('brand param equals fixture:<fixture>', () => {
    const url = new URL(cellToUrl(makeCell({ fixture: 'stripe' }), BASE_HTTPS));
    expect(url.searchParams.get('brand')).toBe('fixture:stripe');
  });

  it.each(['stripe', 'vercel', 'linear', 'notion', 'github'])('brand param is fixture:%s for fixture %s', (fixture) => {
    const url = new URL(cellToUrl(makeCell({ fixture }), BASE_HTTPS));
    expect(url.searchParams.get('brand')).toBe(`fixture:${fixture}`);
  });
});

describe('cellToUrl - search params: app, mode, stack, cms', () => {
  it.each(['landing', 'marketing', 'docs', 'dashboard'])('app param equals %s', (app) => {
    const url = new URL(cellToUrl(makeCell({ app }), BASE_HTTPS));
    expect(url.searchParams.get('app')).toBe(app);
  });

  it.each(['static', 'hybrid', 'spa'])('mode param equals %s', (mode) => {
    const url = new URL(cellToUrl(makeCell({ mode }), BASE_HTTPS));
    expect(url.searchParams.get('mode')).toBe(mode);
  });

  it.each(['vite', 'next', 'astro'])('stack param equals %s', (stack) => {
    const url = new URL(cellToUrl(makeCell({ stack }), BASE_HTTPS));
    expect(url.searchParams.get('stack')).toBe(stack);
  });

  it.each(['vbrand-standalone', 'payload', 'sanity', 'strapi'])('cms param equals %s', (cms) => {
    const url = new URL(cellToUrl(makeCell({ cms }), BASE_HTTPS));
    expect(url.searchParams.get('cms')).toBe(cms);
  });
});

describe('cellToUrl - all five params are present', () => {
  it('URL carries all five required search params', () => {
    const url = new URL(cellToUrl(makeCell(), BASE_HTTPS));
    for (const param of ['brand', 'app', 'mode', 'stack', 'cms']) {
      expect(url.searchParams.has(param)).toBe(true);
    }
  });

  it('index field on the cell does not appear as a search param', () => {
    const url = new URL(cellToUrl(makeCell({ index: 42 }), BASE_HTTPS));
    expect(url.searchParams.has('index')).toBe(false);
  });
});

describe('cellToUrl - determinism', () => {
  it('same cell and base produce the same URL on repeated calls', () => {
    const cell = makeCell();
    expect(cellToUrl(cell, BASE_HTTPS)).toBe(cellToUrl(cell, BASE_HTTPS));
  });

  it('different fixture values produce different URLs', () => {
    const a = cellToUrl(makeCell({ fixture: 'stripe' }), BASE_HTTPS);
    const b = cellToUrl(makeCell({ fixture: 'vercel' }), BASE_HTTPS);
    expect(a).not.toBe(b);
  });

  it('different stack values produce different URLs', () => {
    const a = cellToUrl(makeCell({ stack: 'vite' }), BASE_HTTPS);
    const b = cellToUrl(makeCell({ stack: 'next' }), BASE_HTTPS);
    expect(a).not.toBe(b);
  });

  it('different mode values produce different URLs', () => {
    const a = cellToUrl(makeCell({ mode: 'spa' }), BASE_HTTPS);
    const b = cellToUrl(makeCell({ mode: 'static' }), BASE_HTTPS);
    expect(a).not.toBe(b);
  });

  it('different cms values produce different URLs', () => {
    const a = cellToUrl(makeCell({ cms: 'vbrand-standalone' }), BASE_HTTPS);
    const b = cellToUrl(makeCell({ cms: 'sanity' }), BASE_HTTPS);
    expect(a).not.toBe(b);
  });

  it('different base URLs produce different origins in the output', () => {
    const a = new URL(cellToUrl(makeCell(), BASE_HTTPS));
    const b = new URL(cellToUrl(makeCell(), BASE_HTTP));
    expect(a.origin).not.toBe(b.origin);
  });
});

describe('cellToUrl - optional stack param', () => {
  it('omits stack param when cell.stack is undefined', () => {
    const cell = makeCell({ stack: undefined });
    const url = new URL(cellToUrl(cell, BASE_HTTPS));
    expect(url.searchParams.has('stack')).toBe(false);
  });

  it('includes brand, app, mode, and cms when stack is absent', () => {
    const cell = makeCell({ stack: undefined });
    const url = new URL(cellToUrl(cell, BASE_HTTPS));
    for (const param of ['brand', 'app', 'mode', 'cms']) {
      expect(url.searchParams.has(param)).toBe(true);
    }
  });
});
