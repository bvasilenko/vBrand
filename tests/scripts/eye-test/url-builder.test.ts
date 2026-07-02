// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { describe, it, expect, beforeAll, vi } from 'vitest';

type Cell = { fixture: string; app: string; mode: string; stack: string; cms: string };

let FIXTURES: string[];
let APP_TYPES: string[];
let MODES: string[];
let STACKS: string[];
let CMS_SUBSTRATES: string[];
let cellToUrl: (cell: Cell, baseUrl: string) => string;

beforeAll(async () => {
  const axes = await vi.importActual<{
    FIXTURES: string[]; APP_TYPES: string[]; MODES: string[]; STACKS: string[]; CMS_SUBSTRATES: string[];
  }>('../../../scripts/eye-test/axes.mjs');
  ({ FIXTURES, APP_TYPES, MODES, STACKS, CMS_SUBSTRATES } = axes);

  const mod = await vi.importActual<{ cellToUrl: (cell: Cell, baseUrl: string) => string }>(
    '../../../scripts/eye-test/url-builder.mjs',
  );
  ({ cellToUrl } = mod);
});

const SAMPLE_CELL: Cell = { fixture: 'stripe', app: 'landing', mode: 'static', stack: 'vite', cms: 'payload' };

const BASE_URL_FORMS = [
  'https://bvasilenko.github.io',
  'https://bvasilenko.github.io/',
  'https://bvasilenko.github.io/vBrand/',
  'https://bvasilenko.github.io/some/deep/path',
  'http://localhost:3000',
  'http://localhost:3000/other/path',
] as const;

describe('cellToUrl - URL validity', () => {
  it.each(BASE_URL_FORMS)('produces a parseable URL for base "%s"', (base) => {
    expect(() => new URL(cellToUrl(SAMPLE_CELL, base))).not.toThrow();
  });

  it('result is a non-empty string', () => {
    expect(typeof cellToUrl(SAMPLE_CELL, 'https://example.com')).toBe('string');
    expect(cellToUrl(SAMPLE_CELL, 'https://example.com').length).toBeGreaterThan(0);
  });
});

describe('cellToUrl - path normalization', () => {
  it.each(BASE_URL_FORMS)('pathname is always /vBrand/ regardless of base path in "%s"', (base) => {
    expect(new URL(cellToUrl(SAMPLE_CELL, base)).pathname).toBe('/vBrand/');
  });

  it('URL does not contain double slashes in the path component', () => {
    for (const base of BASE_URL_FORMS) {
      expect(new URL(cellToUrl(SAMPLE_CELL, base)).pathname).not.toContain('//');
    }
  });
});

describe('cellToUrl - origin preservation', () => {
  it.each(BASE_URL_FORMS)('result origin matches the origin of base "%s"', (base) => {
    expect(new URL(cellToUrl(SAMPLE_CELL, base)).origin).toBe(new URL(base).origin);
  });

  it('base URL with path and base URL without path yield the same origin in the result', () => {
    const withPath = new URL(cellToUrl(SAMPLE_CELL, 'https://example.com/deep/path')).origin;
    const withoutPath = new URL(cellToUrl(SAMPLE_CELL, 'https://example.com')).origin;
    expect(withPath).toBe(withoutPath);
  });

  it('trailing-slash and non-trailing-slash base URLs yield the same origin', () => {
    const trailingSlash = new URL(cellToUrl(SAMPLE_CELL, 'https://example.com/')).origin;
    const noTrailingSlash = new URL(cellToUrl(SAMPLE_CELL, 'https://example.com')).origin;
    expect(trailingSlash).toBe(noTrailingSlash);
  });

  it('different origins in the base URL produce different origins in the result', () => {
    const url1 = new URL(cellToUrl(SAMPLE_CELL, 'https://host-a.com')).origin;
    const url2 = new URL(cellToUrl(SAMPLE_CELL, 'https://host-b.com')).origin;
    expect(url1).not.toBe(url2);
  });
});

describe('cellToUrl - query parameters: presence', () => {
  it('includes all five required query parameters', () => {
    const url = new URL(cellToUrl(SAMPLE_CELL, 'https://example.com'));
    for (const param of ['brand', 'app', 'mode', 'stack', 'cms']) {
      expect(url.searchParams.has(param), `missing param: ${param}`).toBe(true);
    }
  });
});

describe('cellToUrl - query parameters: values', () => {
  it('brand param is "fixture:<slug>" for all FIXTURE values', () => {
    for (const fixture of FIXTURES) {
      const url = new URL(cellToUrl({ ...SAMPLE_CELL, fixture }, 'https://example.com'));
      expect(url.searchParams.get('brand')).toBe(`fixture:${fixture}`);
    }
  });

  it('app param reflects cell.app for all APP_TYPE values', () => {
    for (const app of APP_TYPES) {
      const url = new URL(cellToUrl({ ...SAMPLE_CELL, app }, 'https://example.com'));
      expect(url.searchParams.get('app')).toBe(app);
    }
  });

  it('mode param reflects cell.mode for all MODE values', () => {
    for (const mode of MODES) {
      const url = new URL(cellToUrl({ ...SAMPLE_CELL, mode }, 'https://example.com'));
      expect(url.searchParams.get('mode')).toBe(mode);
    }
  });

  it('stack param reflects cell.stack for all STACK values', () => {
    for (const stack of STACKS) {
      const url = new URL(cellToUrl({ ...SAMPLE_CELL, stack }, 'https://example.com'));
      expect(url.searchParams.get('stack')).toBe(stack);
    }
  });

  it('cms param reflects cell.cms for all CMS_SUBSTRATE values', () => {
    for (const cms of CMS_SUBSTRATES) {
      const url = new URL(cellToUrl({ ...SAMPLE_CELL, cms }, 'https://example.com'));
      expect(url.searchParams.get('cms')).toBe(cms);
    }
  });
});

describe('cellToUrl - determinism and independence', () => {
  it('same cell and base always produces the same URL', () => {
    const a = cellToUrl(SAMPLE_CELL, 'https://example.com');
    const b = cellToUrl(SAMPLE_CELL, 'https://example.com');
    expect(a).toBe(b);
  });

  it('different fixture values produce different URLs', () => {
    const url1 = cellToUrl({ ...SAMPLE_CELL, fixture: 'stripe' }, 'https://example.com');
    const url2 = cellToUrl({ ...SAMPLE_CELL, fixture: 'vercel' }, 'https://example.com');
    expect(url1).not.toBe(url2);
  });

  it('all five axis fields independently affect the resulting URL', () => {
    const base = 'https://example.com';
    const altCell: Cell = {
      fixture: FIXTURES.find((v) => v !== SAMPLE_CELL.fixture) ?? FIXTURES[0] ?? '',
      app:     APP_TYPES.find((v) => v !== SAMPLE_CELL.app)     ?? APP_TYPES[0] ?? '',
      mode:    MODES.find((v) => v !== SAMPLE_CELL.mode)         ?? MODES[0] ?? '',
      stack:   STACKS.find((v) => v !== SAMPLE_CELL.stack)       ?? STACKS[0] ?? '',
      cms:     CMS_SUBSTRATES.find((v) => v !== SAMPLE_CELL.cms) ?? CMS_SUBSTRATES[0] ?? '',
    };
    const baseUrl = cellToUrl(SAMPLE_CELL, base);
    for (const field of ['fixture', 'app', 'mode', 'stack', 'cms'] as Array<keyof Cell>) {
      const altUrl = cellToUrl({ ...SAMPLE_CELL, [field]: altCell[field] }, base);
      expect(altUrl, `field "${field}" change should alter URL`).not.toBe(baseUrl);
    }
  });
});
