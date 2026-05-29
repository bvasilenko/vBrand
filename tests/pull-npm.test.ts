// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchFromNpm } from '../src/lib/pull/from-npm.js';

afterEach(() => { vi.restoreAllMocks(); });

function mockFetch(response: {
  ok: boolean;
  status?: number;
  statusText?: string;
  json?: () => Promise<unknown>;
}): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: response.ok,
      status: response.status ?? 200,
      statusText: response.statusText ?? 'OK',
      json: response.json ?? (() => Promise.resolve({})),
    }),
  );
}

const REGISTRY_RESPONSE = {
  name: 'my-package',
  description: 'A test package',
  keywords: ['fast', '#0f172a', 'cli'],
};

describe('fetchFromNpm - CandidateDoc shape', () => {
  it('returns $candidate: true', async () => {
    mockFetch({ ok: true, json: () => Promise.resolve(REGISTRY_RESPONSE) });
    const doc = await fetchFromNpm('my-package');
    expect(doc.$candidate).toBe(true);
  });

  it('sets sourceUri to npm:<packageName>', async () => {
    mockFetch({ ok: true, json: () => Promise.resolve(REGISTRY_RESPONSE) });
    const doc = await fetchFromNpm('my-package');
    expect(doc.sourceUri).toBe('npm:my-package');
  });
});

describe('fetchFromNpm - name field', () => {
  it('extracts name with high confidence', async () => {
    mockFetch({ ok: true, json: () => Promise.resolve(REGISTRY_RESPONSE) });
    const doc = await fetchFromNpm('my-package');
    expect(doc.fields.name.value).toBe('my-package');
    expect(doc.fields.name.confidence).toBe('high');
  });

  it('strips scoped package prefix from name', async () => {
    const scoped = { name: '@scope/my-lib', keywords: [] };
    mockFetch({ ok: true, json: () => Promise.resolve(scoped) });
    const doc = await fetchFromNpm('@scope/my-lib');
    expect(doc.fields.name.value).toBe('my-lib');
  });

  it('uses the package argument as fallback when registry name is missing', async () => {
    mockFetch({ ok: true, json: () => Promise.resolve({ keywords: [] }) });
    const doc = await fetchFromNpm('fallback-pkg');
    expect(doc.fields.name.value).toBe('fallback-pkg');
  });
});

describe('fetchFromNpm - colors field', () => {
  it('extracts hex color keyword with low confidence', async () => {
    mockFetch({ ok: true, json: () => Promise.resolve(REGISTRY_RESPONSE) });
    const doc = await fetchFromNpm('my-package');
    expect(doc.fields.colors.value?.['primary']).toBe('#0f172a');
    expect(doc.fields.colors.confidence).toBe('low');
  });

  it('returns colors with confidence:none when no hex keyword', async () => {
    const noColor = { name: 'colorless', keywords: ['cli', 'tool'] };
    mockFetch({ ok: true, json: () => Promise.resolve(noColor) });
    const doc = await fetchFromNpm('colorless');
    expect(doc.fields.colors.confidence).toBe('none');
  });

  it('handles response with no keywords array', async () => {
    mockFetch({ ok: true, json: () => Promise.resolve({ name: 'bare' }) });
    const doc = await fetchFromNpm('bare');
    expect(doc.fields.colors.confidence).toBe('none');
  });

  it('accepts 3-char hex color keyword', async () => {
    const threeChar = { name: 'colorpkg', keywords: ['#abc'] };
    mockFetch({ ok: true, json: () => Promise.resolve(threeChar) });
    const doc = await fetchFromNpm('colorpkg');
    expect(doc.fields.colors.value?.['primary']).toBe('#abc');
  });

  it('ignores invalid hex-like keywords', async () => {
    const mixed = { name: 'mixed', keywords: ['notacolor', 'red', '#gggggg'] };
    mockFetch({ ok: true, json: () => Promise.resolve(mixed) });
    const doc = await fetchFromNpm('mixed');
    expect(doc.fields.colors.confidence).toBe('none');
  });
});

describe('fetchFromNpm - error handling', () => {
  it('throws on HTTP error status', async () => {
    mockFetch({ ok: false, status: 404, statusText: 'Not Found' });
    await expect(fetchFromNpm('nonexistent')).rejects.toThrow(/Failed to fetch npm package/);
  });

  it('error message includes the package name', async () => {
    mockFetch({ ok: false, status: 500, statusText: 'Internal Server Error' });
    try {
      await fetchFromNpm('my-pkg');
    } catch (err) {
      expect((err as Error).message).toContain('my-pkg');
    }
  });

  it('throws on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    await expect(fetchFromNpm('unreachable')).rejects.toThrow(/Failed to fetch npm package/);
  });

  it('wraps network error message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('DNS failure')));
    try {
      await fetchFromNpm('unreachable');
    } catch (err) {
      expect((err as Error).message).toContain('DNS failure');
    }
  });
});
