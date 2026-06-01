// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { describe, it, expect, vi, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { VbrandSchema } from '../../schema.js';
import { DefaultBrandSourceAdapter } from './default-adapter.js';
import { resolveGitHubHomepage, resolveNpmHomepage } from './url-resolvers.js';
import { fixtures } from '@booga/vfixtures';

const stripeFixture = fixtures.stripe;

const GH_OK = (homepage: string | null) =>
  new Response(JSON.stringify({ homepage }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

const GH_NOT_FOUND = () =>
  new Response(JSON.stringify({ message: 'Not Found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  });

const NPM_OK = (homepage: string | null) =>
  new Response(JSON.stringify({ name: 'test', homepage }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

const NPM_NOT_FOUND = () =>
  new Response(JSON.stringify({ error: 'Not found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  });

afterEach(() => { vi.unstubAllGlobals(); });

describe('DefaultBrandSourceAdapter: pure-source methods', () => {
  const adapter = new DefaultBrandSourceAdapter();

  it('loadFromFixture returns VbrandSchema-valid object', async () => {
    const result = await adapter.loadFromFixture('stripe');
    expect(VbrandSchema.safeParse(result).success).toBe(true);
  });

  it('loadFromFixture rejects unknown handle', async () => {
    await expect(adapter.loadFromFixture('does-not-exist-xyz')).rejects.toThrow();
  });

  it('loadFromFixture error message names the unknown handle', async () => {
    await expect(adapter.loadFromFixture('no-such-fixture')).rejects.toThrow('no-such-fixture');
  });

  it('loadFromCustomJson accepts valid payload', async () => {
    const result = await adapter.loadFromCustomJson(stripeFixture);
    expect(VbrandSchema.safeParse(result).success).toBe(true);
  });

  it('loadFromCustomJson rejects payload missing required fields', async () => {
    await expect(adapter.loadFromCustomJson({ notABrand: true })).rejects.toThrow();
  });

  it('loadFromCustomJson rejects null payload', async () => {
    await expect(adapter.loadFromCustomJson(null)).rejects.toThrow();
  });

  it('loadFromCustomJson rejects array payload', async () => {
    await expect(adapter.loadFromCustomJson([stripeFixture])).rejects.toThrow();
  });

  it('loadFromCustomJson rejects string payload', async () => {
    await expect(adapter.loadFromCustomJson('{"name":"x"}')).rejects.toThrow();
  });

  it('loadFromLocalJson accepts a valid file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'vbrand-adapter-test-'));
    try {
      const path = join(dir, 'brand.json');
      writeFileSync(path, JSON.stringify(stripeFixture));
      const result = await adapter.loadFromLocalJson(path);
      expect(VbrandSchema.safeParse(result).success).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('loadFromLocalJson rejects a file with invalid schema', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'vbrand-adapter-test-'));
    try {
      const path = join(dir, 'bad.json');
      writeFileSync(path, JSON.stringify({ x: 1 }));
      await expect(adapter.loadFromLocalJson(path)).rejects.toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('loadFromLocalJson rejects a file with malformed JSON', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'vbrand-adapter-test-'));
    try {
      const path = join(dir, 'malformed.json');
      writeFileSync(path, '{ "name": "acme", INVALID }');
      await expect(adapter.loadFromLocalJson(path)).rejects.toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('loadFromLocalJson rejects a path that does not exist', async () => {
    await expect(adapter.loadFromLocalJson('/nonexistent/path/brand.json')).rejects.toThrow();
  });
});

describe('DefaultBrandSourceAdapter: structural equivalence', () => {
  const adapter = new DefaultBrandSourceAdapter();

  it('loadFromFixture and loadFromCustomJson produce objects with identical top-level keys', async () => {
    const fromFixture = await adapter.loadFromFixture('stripe');
    const fromCustom = await adapter.loadFromCustomJson(stripeFixture);
    expect(Object.keys(fromFixture).sort()).toEqual(Object.keys(fromCustom).sort());
  });

  it('loadFromLocalJson produces same top-level key shape as loadFromFixture', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'vbrand-adapter-test-'));
    try {
      const path = join(dir, 'brand.json');
      writeFileSync(path, JSON.stringify(stripeFixture));
      const fromLocal = await adapter.loadFromLocalJson(path);
      const fromFixture = await adapter.loadFromFixture('stripe');
      expect(Object.keys(fromLocal).sort()).toEqual(Object.keys(fromFixture).sort());
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('all known fixture slugs produce VbrandSchema-valid objects', async () => {
    const slugs = ['stripe', 'vercel', 'linear', 'notion', 'github'];
    for (const slug of slugs) {
      const result = await adapter.loadFromFixture(slug);
      expect(VbrandSchema.safeParse(result).success, `fixture "${slug}" failed schema`).toBe(true);
    }
  });
});

describe('resolveGitHubHomepage - URL resolution', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('returns homepage when GitHub API responds with a non-empty homepage', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => GH_OK('https://stripe.com')));
    expect(await resolveGitHubHomepage('stripe', 'stripe-js')).toBe('https://stripe.com');
  });

  it('falls back to GitHub Pages URL when API returns null homepage', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => GH_OK(null)));
    expect(await resolveGitHubHomepage('stripe', 'stripe-js')).toBe('https://stripe.github.io/stripe-js');
  });

  it('falls back when API returns empty string homepage', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => GH_OK('')));
    expect(await resolveGitHubHomepage('stripe', 'stripe-js')).toBe('https://stripe.github.io/stripe-js');
  });

  it('falls back when API responds with a non-OK status', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => GH_NOT_FOUND()));
    expect(await resolveGitHubHomepage('myorg', 'myrepo')).toBe('https://myorg.github.io/myrepo');
  });

  it('falls back when fetch throws a network error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network'); }));
    expect(await resolveGitHubHomepage('stripe', 'stripe-js')).toBe('https://stripe.github.io/stripe-js');
  });

  it('fallback URL embeds owner and repo in the correct positions', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => GH_OK(null)));
    const url = await resolveGitHubHomepage('myorg', 'myrepo');
    expect(url).toBe('https://myorg.github.io/myrepo');
  });

  it('fallback URL format is always https://{owner}.github.io/{repo}', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const url = await resolveGitHubHomepage('acme-corp', 'brand-kit');
    expect(url).toMatch(/^https:\/\/acme-corp\.github\.io\/brand-kit$/);
  });
});

describe('resolveNpmHomepage - URL resolution', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('returns homepage when npm registry responds with a non-empty homepage', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => NPM_OK('https://stripe.com')));
    expect(await resolveNpmHomepage('@stripe/stripe-js')).toBe('https://stripe.com');
  });

  it('falls back to npmjs.com URL when registry returns null homepage', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => NPM_OK(null)));
    expect(await resolveNpmHomepage('@stripe/stripe-js')).toContain('npmjs.com');
  });

  it('falls back when registry returns empty string homepage', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => NPM_OK('')));
    expect(await resolveNpmHomepage('react')).toContain('npmjs.com');
  });

  it('falls back when registry responds with a non-OK status', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => NPM_NOT_FOUND()));
    expect(await resolveNpmHomepage('unknown-pkg')).toContain('npmjs.com');
  });

  it('falls back when fetch throws a network error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network'); }));
    expect(await resolveNpmHomepage('stripe')).toContain('npmjs.com');
  });

  it('fallback URL for unscoped package contains the package name', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => NPM_OK(null)));
    const url = await resolveNpmHomepage('react');
    expect(url).toContain('react');
    expect(url).toContain('npmjs.com');
  });

  it('fallback URL for scoped package encodes the scope separator', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => NPM_OK(null)));
    const url = await resolveNpmHomepage('@scope/pkg');
    expect(url).toContain('npmjs.com');
    expect(url).not.toContain('@scope/pkg');
  });
});
