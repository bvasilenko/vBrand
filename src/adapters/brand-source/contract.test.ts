// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { VbrandSchema, type VbrandType } from '../../schema.js';
import { DefaultBrandSourceAdapter } from './default-adapter.js';
import { BrowserBrandSourceAdapter } from './browser-adapter.js';
import { CorsBlockedError } from './cors-error.js';
import { resolveGitHubHomepage, resolveNpmHomepage } from './url-resolvers.js';
import { fixtures } from '@booga/vfixtures';
import { runFuse } from '../../commands/fuse.js';

vi.mock('../../commands/pull.js');
vi.mock('../../commands/fuse.js');


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

const GH_FULL = (owner: string, repo: string, homepage: string | null) =>
  new Response(
    JSON.stringify({
      name: repo,
      full_name: `${owner}/${repo}`,
      description: `${owner} SDK`,
      homepage,
      owner: { login: owner, avatar_url: `https://github.com/${owner}.png` },
      topics: [],
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );

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

describe('BrowserBrandSourceAdapter: pure-source methods', () => {
  const adapter = new BrowserBrandSourceAdapter();

  it('loadFromLocalJson always throws with a message indicating browser context', async () => {
    await expect(adapter.loadFromLocalJson('/any/path.json')).rejects.toThrow(/browser/i);
  });

  it('loadFromLocalJson throws regardless of the path argument', async () => {
    await expect(adapter.loadFromLocalJson('')).rejects.toThrow();
    await expect(adapter.loadFromLocalJson('/nonexistent/path')).rejects.toThrow();
  });

  it('loadFromCustomJson accepts valid payload and returns VbrandSchema-valid object', async () => {
    const result = await adapter.loadFromCustomJson(stripeFixture);
    expect(VbrandSchema.safeParse(result).success).toBe(true);
  });

  it('loadFromCustomJson rejects null payload', async () => {
    await expect(adapter.loadFromCustomJson(null)).rejects.toThrow();
  });

  it('loadFromCustomJson rejects string payload', async () => {
    await expect(adapter.loadFromCustomJson('{"name":"x"}')).rejects.toThrow();
  });

  it('loadFromFixture returns VbrandSchema-valid object for all known slugs', async () => {
    const slugs = ['stripe', 'vercel', 'linear', 'notion', 'github'];
    for (const slug of slugs) {
      const result = await adapter.loadFromFixture(slug);
      expect(VbrandSchema.safeParse(result).success, `fixture "${slug}" failed`).toBe(true);
    }
  });

  it('loadFromFixture rejects unknown handle', async () => {
    await expect(adapter.loadFromFixture('does-not-exist-xyz')).rejects.toThrow();
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

describe('DefaultBrandSourceAdapter: loadFromUrl structural equivalence', () => {
  const adapter = new DefaultBrandSourceAdapter();

  beforeEach(() => {
    vi.mocked(runFuse).mockImplementation(async (_inputs, opts) => {
      const { schemaPath } = opts as { schemaPath: string };
      writeFileSync(schemaPath, JSON.stringify(stripeFixture));
      return undefined as never;
    });
  });

  afterEach(() => { vi.clearAllMocks(); });

  it('loadFromUrl result is VbrandSchema-valid', async () => {
    const result = await adapter.loadFromUrl('https://stripe.com');
    expect(VbrandSchema.safeParse(result).success).toBe(true);
  });

  it('loadFromUrl result has same top-level key shape as loadFromFixture', async () => {
    const fromUrl = await adapter.loadFromUrl('https://stripe.com');
    const fromFixture = await adapter.loadFromFixture('stripe');
    expect(Object.keys(fromUrl).sort()).toEqual(Object.keys(fromFixture).sort());
  });

  it('loadFromUrl calls runFuse with the tmp schemaPath', async () => {
    await adapter.loadFromUrl('https://stripe.com');
    expect(vi.mocked(runFuse)).toHaveBeenCalledOnce();
    const [, opts] = vi.mocked(runFuse).mock.calls[0]!;
    expect((opts as { schemaPath: string }).schemaPath).toMatch(/vbrand\.schema\.json$/);
  });

  it('loadFromUrl propagates a runFuse error to the caller', async () => {
    vi.mocked(runFuse).mockRejectedValueOnce(new Error('fuse-failed'));
    await expect(adapter.loadFromUrl('https://stripe.com')).rejects.toThrow('fuse-failed');
  });

  it('loadFromUrl throws when runFuse writes invalid JSON', async () => {
    vi.mocked(runFuse).mockImplementation(async (_inputs, opts) => {
      const { schemaPath } = opts as { schemaPath: string };
      writeFileSync(schemaPath, '{ invalid json }');
      return undefined as never;
    });
    await expect(adapter.loadFromUrl('https://stripe.com')).rejects.toThrow();
  });
});

describe('BrowserBrandSourceAdapter.loadFromGitHub: cross-origin homepage pre-check', () => {
  const OWNER = 'stripe';
  const REPO = 'stripe-js';

  it.each([
    ['https://stripe.com', 'stripe', 'stripe-js'],
    ['https://linear.app', 'linear', 'linear-app'],
    ['https://vercel.com', 'vercel', 'vercel'],
  ])(
    'never fetches cross-origin homepage %s; all fetch calls stay on api.github.com',
    async (homepage, owner, repo) => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce(GH_FULL(owner, repo, homepage))
        .mockResolvedValueOnce(GH_FULL(owner, repo, homepage));
      vi.stubGlobal('fetch', fetchMock);

      await new BrowserBrandSourceAdapter().loadFromGitHub(owner, repo);

      const calledUrls = fetchMock.mock.calls.map(([url]: [string]) => String(url));
      const homepageHostname = new URL(homepage).hostname;
      expect(calledUrls.every((url) => url.includes('api.github.com'))).toBe(true);
      expect(calledUrls.every((url) => !url.includes(homepageHostname))).toBe(true);
    },
  );

  it('returns a VbrandSchema-valid brand derived from GitHub metadata when homepage is cross-origin', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(GH_FULL(OWNER, REPO, 'https://stripe.com'))
      .mockResolvedValueOnce(GH_FULL(OWNER, REPO, 'https://stripe.com')));

    const result = await new BrowserBrandSourceAdapter().loadFromGitHub(OWNER, REPO);

    expect(VbrandSchema.safeParse(result).success).toBe(true);
  });

  it('result carries the github:{owner}/{repo} source tag', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(GH_FULL(OWNER, REPO, 'https://stripe.com'))
      .mockResolvedValueOnce(GH_FULL(OWNER, REPO, 'https://stripe.com')));

    const result = await new BrowserBrandSourceAdapter().loadFromGitHub(OWNER, REPO);

    expect(result.sources).toContain(`github:${OWNER}/${REPO}`);
  });

  it('takes the metadata path when GitHub Pages fallback URL is also cross-origin', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(GH_FULL(OWNER, REPO, null))
      .mockResolvedValueOnce(GH_FULL(OWNER, REPO, null));
    vi.stubGlobal('fetch', fetchMock);

    const result = await new BrowserBrandSourceAdapter().loadFromGitHub(OWNER, REPO);

    expect(VbrandSchema.safeParse(result).success).toBe(true);
    const calledUrls = fetchMock.mock.calls.map(([url]: [string]) => String(url));
    expect(calledUrls.some((url) => url.includes('github.io'))).toBe(false);
  });

  it('calls loadFromUrl when the resolved homepage is same-origin as the page', async () => {
    const SAME_ORIGIN_HOMEPAGE = 'https://my-app.com/brand';
    vi.stubGlobal('location', { origin: 'https://my-app.com' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(GH_FULL(OWNER, REPO, SAME_ORIGIN_HOMEPAGE)));

    const adapter = new BrowserBrandSourceAdapter();
    const spy = vi.spyOn(adapter, 'loadFromUrl').mockResolvedValueOnce(stripeFixture as VbrandType);

    await adapter.loadFromGitHub(OWNER, REPO);

    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(SAME_ORIGIN_HOMEPAGE);
  });

  it('falls back to GitHub metadata when loadFromUrl throws CorsBlockedError', async () => {
    const SAME_ORIGIN_HOMEPAGE = 'https://my-app.com/brand';
    vi.stubGlobal('location', { origin: 'https://my-app.com' });
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(GH_FULL(OWNER, REPO, SAME_ORIGIN_HOMEPAGE))
      .mockResolvedValueOnce(GH_FULL(OWNER, REPO, SAME_ORIGIN_HOMEPAGE)));

    const adapter = new BrowserBrandSourceAdapter();
    vi.spyOn(adapter, 'loadFromUrl').mockRejectedValueOnce(new CorsBlockedError(SAME_ORIGIN_HOMEPAGE));

    const result = await adapter.loadFromGitHub(OWNER, REPO);

    expect(VbrandSchema.safeParse(result).success).toBe(true);
  });

  it('propagates non-CORS errors from loadFromUrl without swallowing them', async () => {
    const SAME_ORIGIN_HOMEPAGE = 'https://my-app.com/brand';
    vi.stubGlobal('location', { origin: 'https://my-app.com' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(GH_FULL(OWNER, REPO, SAME_ORIGIN_HOMEPAGE)));

    const adapter = new BrowserBrandSourceAdapter();
    vi.spyOn(adapter, 'loadFromUrl').mockRejectedValueOnce(new Error('upstream-500'));

    await expect(adapter.loadFromGitHub(OWNER, REPO)).rejects.toThrow('upstream-500');
  });
});
