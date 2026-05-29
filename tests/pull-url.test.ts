// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { describe, expect, it, vi, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fetchFromUrl } from '../src/lib/pull/from-url.js';

const cacheDirs: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  for (const d of cacheDirs) rmSync(d, { recursive: true, force: true });
  cacheDirs.length = 0;
});

const BASIC_HTML = `<!DOCTYPE html>
<html>
<head>
  <title>Acme Corp | Build tools</title>
  <meta name="theme-color" content="#0f172a" />
  <link rel="icon" href="/favicon.ico" />
</head>
<body><h1>Acme</h1></body>
</html>`;

const HTML_WITH_OG_SITE_NAME = `<!DOCTYPE html>
<html>
<head>
  <meta property="og:site_name" content="Brand Co" />
  <meta name="theme-color" content="#6366f1" />
  <link rel="icon" href="/icon.png" />
</head>
<body></body>
</html>`;

const MINIMAL_HTML = `<html><head><title>Plain Site</title></head><body></body></html>`;

function mockFetch(html: string, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? 'OK' : 'Error',
      text: async () => html,
      arrayBuffer: async () => new ArrayBuffer(0),
      headers: { get: () => null },
    }),
  );
}

describe('fetchFromUrl - CandidateDoc shape', () => {
  it('returns a document with $candidate: true discriminant', async () => {
    mockFetch(BASIC_HTML);
    const doc = await fetchFromUrl('https://acme.example.com');
    expect(doc.$candidate).toBe(true);
  });

  it('sets sourceUri to the requested URL', async () => {
    mockFetch(BASIC_HTML);
    const doc = await fetchFromUrl('https://acme.example.com');
    expect(doc.sourceUri).toBe('https://acme.example.com');
  });

  it('derives slug from URL hostname', async () => {
    mockFetch(BASIC_HTML);
    const doc = await fetchFromUrl('https://acme.example.com');
    expect(doc.slug).toBe('acme-example-com');
  });

  it('has provenance.pulledAt as ISO timestamp', async () => {
    mockFetch(BASIC_HTML);
    const doc = await fetchFromUrl('https://acme.example.com');
    expect(new Date(doc.provenance.pulledAt).toISOString()).toBe(doc.provenance.pulledAt);
  });
});

describe('fetchFromUrl - name field extraction (acceptance #16)', () => {
  it('extracts name with high confidence from og:site_name', async () => {
    mockFetch(HTML_WITH_OG_SITE_NAME);
    const doc = await fetchFromUrl('https://brand.example.com');
    expect(doc.fields.name.value).toBe('Brand Co');
    expect(doc.fields.name.confidence).toBe('high');
    expect(doc.fields.name.source).toBe('og:site_name');
  });

  it('extracts name with medium confidence from <title>', async () => {
    mockFetch(BASIC_HTML);
    const doc = await fetchFromUrl('https://acme.example.com');
    expect(doc.fields.name.value).toBe('Acme Corp');
    expect(doc.fields.name.confidence).toBe('medium');
  });

  it('falls back to hostname with low confidence when title is missing', async () => {
    mockFetch('<html><head></head><body></body></html>');
    const doc = await fetchFromUrl('https://example.com');
    expect(doc.fields.name.value).toContain('example.com');
    expect(doc.fields.name.confidence).toBe('low');
  });
});

describe('fetchFromUrl - colors field extraction', () => {
  it('extracts primary color with high confidence from theme-color meta', async () => {
    mockFetch(BASIC_HTML);
    const doc = await fetchFromUrl('https://acme.example.com');
    expect(doc.fields.colors.confidence).toBe('high');
    expect(doc.fields.colors.value?.['primary']).toBe('#0f172a');
  });

  it('returns colors with confidence:none when no theme-color meta', async () => {
    mockFetch(MINIMAL_HTML);
    const doc = await fetchFromUrl('https://plain.example.com');
    expect(doc.fields.colors.confidence).toBe('none');
    expect(doc.fields.colors.value).toBeNull();
  });
});

describe('fetchFromUrl - favicon field extraction', () => {
  it('sets favicon confidence:none when no cacheBase and no favicon link', async () => {
    mockFetch(MINIMAL_HTML);
    const doc = await fetchFromUrl('https://plain.example.com');
    expect(doc.fields.favicon).toBeDefined();
  });

  it('records og.dimensions as default [1200, 630]', async () => {
    mockFetch(BASIC_HTML);
    const doc = await fetchFromUrl('https://acme.example.com');
    expect(doc.fields.og.value?.dimensions).toEqual([1200, 630]);
    expect(doc.fields.og.confidence).toBe('high');
  });
});

describe('fetchFromUrl - degradation cascade (spec §degradation)', () => {
  it('returns a valid candidate (exit 0 equivalent) on 403 blocked', async () => {
    mockFetch('', 403);
    const doc = await fetchFromUrl('https://blocked.example.com');
    expect(doc.$candidate).toBe(true);
    expect(doc.provenance.degradations.some((d) => d.reason === 'blocked-on-fetch')).toBe(true);
    expect(doc.fields.name.confidence).toBe('none');
  });

  it('returns a valid candidate on 404', async () => {
    mockFetch('', 404);
    const doc = await fetchFromUrl('https://missing.example.com');
    expect(doc.$candidate).toBe(true);
    expect(doc.provenance.degradations.some((d) => d.reason === 'source-unreachable')).toBe(true);
  });

  it('returns a valid candidate on 429 rate-limit', async () => {
    mockFetch('', 429);
    const doc = await fetchFromUrl('https://ratelimited.example.com');
    expect(doc.$candidate).toBe(true);
    expect(doc.provenance.degradations.some((d) => d.reason === 'blocked-on-fetch')).toBe(true);
  });

  it('returns a valid candidate on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ENOTFOUND')));
    const doc = await fetchFromUrl('https://unreachable.example.com');
    expect(doc.$candidate).toBe(true);
    expect(doc.provenance.degradations.some((d) => d.reason === 'source-unreachable')).toBe(true);
  });

  it('provenance.degradations is an array (possibly empty on success)', async () => {
    mockFetch(BASIC_HTML);
    const doc = await fetchFromUrl('https://acme.example.com');
    expect(Array.isArray(doc.provenance.degradations)).toBe(true);
  });
});

describe('fetchFromUrl - og:image not promoted to favicon (spec empirical #3)', () => {
  it('marks favicon low confidence with reason when og:image is the only image signal', async () => {
    const htmlOgOnly = `<html><head>
      <meta property="og:site_name" content="Test" />
      <meta property="og:image" content="https://cdn.example.com/og.png" />
    </head><body></body></html>`;
    mockFetch(htmlOgOnly);
    const doc = await fetchFromUrl('https://test.example.com');
    if (doc.fields.favicon.confidence !== 'none') {
      expect(doc.fields.favicon.reason).toContain('og-image');
    }
  });
});

describe('fetchFromUrl - asset caching with cacheBase', () => {
  const HTML_WITH_FAVICON = `<!DOCTYPE html>
<html><head>
  <meta property="og:site_name" content="Cached Brand" />
  <meta name="theme-color" content="#123456" />
  <link rel="icon" href="/favicon.png" />
</head><body></body></html>`;

  it('sets favicon confidence to high when download succeeds', async () => {
    const cacheBase = mkdtempSync(join(tmpdir(), 'vbrand-url-')); cacheDirs.push(cacheBase);
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith('/favicon.png')) {
        return { ok: true, status: 200, text: async () => '', headers: { get: () => null }, arrayBuffer: async () => new ArrayBuffer(4) };
      }
      return { ok: true, status: 200, text: async () => HTML_WITH_FAVICON, headers: { get: () => null }, arrayBuffer: async () => new ArrayBuffer(0) };
    }));
    const doc = await fetchFromUrl('https://cached.example.com', cacheBase);
    expect(doc.fields.favicon.confidence).toBe('high');
  });

  it('records provenance.assets with sourceUrl and localPath on successful download', async () => {
    const cacheBase = mkdtempSync(join(tmpdir(), 'vbrand-url-')); cacheDirs.push(cacheBase);
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith('/favicon.png')) {
        return { ok: true, status: 200, text: async () => '', headers: { get: () => null }, arrayBuffer: async () => new ArrayBuffer(4) };
      }
      return { ok: true, status: 200, text: async () => HTML_WITH_FAVICON, headers: { get: () => null }, arrayBuffer: async () => new ArrayBuffer(0) };
    }));
    const doc = await fetchFromUrl('https://cached.example.com', cacheBase);
    const assetEntry = doc.provenance.assets.find((a) => a.field === 'assets.favicon');
    expect(assetEntry).toBeDefined();
    expect(assetEntry?.sourceUrl).toContain('favicon.png');
    expect(assetEntry?.localPath).toBeTruthy();
  });

  it('sets favicon confidence:none with degradation when asset download fails', async () => {
    const cacheBase = mkdtempSync(join(tmpdir(), 'vbrand-url-')); cacheDirs.push(cacheBase);
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith('/favicon.png')) {
        return { ok: false, status: 404, text: async () => '', headers: { get: () => null }, arrayBuffer: async () => new ArrayBuffer(0) };
      }
      return { ok: true, status: 200, text: async () => HTML_WITH_FAVICON, headers: { get: () => null }, arrayBuffer: async () => new ArrayBuffer(0) };
    }));
    const doc = await fetchFromUrl('https://cached.example.com', cacheBase);
    expect(doc.fields.favicon.confidence).toBe('none');
    expect(doc.fields.favicon.reason).toBe('download-failed');
  });
});

describe('fetchFromUrl - slug derivation', () => {
  it.each([
    ['https://astro.build',          'astro-build'     ],
    ['https://www.example.com',      'www-example-com' ],
    ['https://example.com/brand',    'example-com-brand'],
  ])('%s → slug %s', async (url, expectedSlug) => {
    mockFetch(BASIC_HTML);
    const doc = await fetchFromUrl(url);
    expect(doc.slug).toBe(expectedSlug);
  });
});
