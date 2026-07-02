// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useCmsContent } from '../src/use-cms-content.js';
import type { ContentTree } from '@booga/vbrand/cms';
import type { CmsName } from '../src/router.js';

type LoadFn = (slug?: string) => Promise<ContentTree>;
const ADAPTER_IMPLS: Record<CmsName, LoadFn> = {
  'vbrand-standalone': () => Promise.resolve({}),
  payload:             () => Promise.resolve({}),
  sanity:              () => Promise.resolve({}),
  strapi:              () => Promise.resolve({}),
};

vi.mock('@booga/vbrand/cms', () => ({
  getCmsSubstrate: (name: CmsName) => ({
    loadContent: (slug?: string) => ADAPTER_IMPLS[name](slug),
  }),
}));

interface WrapperProps { cms: CmsName; fixtureSlug: string | undefined }

function Wrapper({ cms, fixtureSlug }: WrapperProps): React.ReactElement {
  const tree = useCmsContent(cms, fixtureSlug);
  return React.createElement('pre', { 'data-testid': 'result' }, JSON.stringify(tree));
}

function resultText(container: HTMLElement): string {
  return container.querySelector('[data-testid="result"]')?.textContent ?? '';
}

function resultObject(container: HTMLElement): ContentTree {
  return JSON.parse(resultText(container)) as ContentTree;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  delete (window as Partial<Window & { __vbrand_content_tree__?: ContentTree }>).__vbrand_content_tree__;
  for (const key of Object.keys(ADAPTER_IMPLS) as CmsName[]) {
    ADAPTER_IMPLS[key] = () => Promise.resolve({});
  }
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

async function render(cms: CmsName, fixtureSlug?: string): Promise<void> {
  await act(async () => {
    root.render(React.createElement(Wrapper, { cms, fixtureSlug }));
  });
}

async function rerender(cms: CmsName, fixtureSlug?: string): Promise<void> {
  await act(async () => {
    root.render(React.createElement(Wrapper, { cms, fixtureSlug }));
  });
}

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void; reject: (reason: unknown) => void };

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe('useCmsContent: initial state', () => {
  it('returns an empty object synchronously before the adapter resolves', async () => {
    const d = deferred<ContentTree>();
    ADAPTER_IMPLS['vbrand-standalone'] = () => d.promise;

    await act(async () => {
      root.render(React.createElement(Wrapper, { cms: 'vbrand-standalone', fixtureSlug: undefined }));
    });

    expect(resultObject(container)).toEqual({});
  });

  it('returns the adapter ContentTree after resolution', async () => {
    ADAPTER_IMPLS['vbrand-standalone'] = () => Promise.resolve({ 'landing.hero.heading': 'Hello' } as ContentTree);
    await render('vbrand-standalone');
    expect(resultObject(container)).toEqual({ 'landing.hero.heading': 'Hello' });
  });

  it('returns an empty object when the adapter resolves with an empty ContentTree', async () => {
    ADAPTER_IMPLS['vbrand-standalone'] = () => Promise.resolve({});
    await render('vbrand-standalone');
    expect(resultObject(container)).toEqual({});
  });
});

describe('useCmsContent: adapter selection', () => {
  const CMS_NAMES: CmsName[] = ['vbrand-standalone', 'payload', 'sanity', 'strapi'];

  it.each(CMS_NAMES)('uses the "%s" adapter when cms="%s"', async (cms) => {
    const sentinel = { 'landing.hero.heading': `from-${cms}` } as ContentTree;
    ADAPTER_IMPLS[cms] = () => Promise.resolve(sentinel);
    await render(cms);
    expect(resultObject(container)).toEqual(sentinel);
  });

  it('each CmsName resolves via its own distinct adapter, not another', async () => {
    const treesReturned: Record<string, ContentTree> = {};
    for (const cms of CMS_NAMES) {
      const sentinel = { 'landing.hero.heading': `sentinel-${cms}` } as ContentTree;
      ADAPTER_IMPLS[cms] = () => Promise.resolve(sentinel);
      await render(cms);
      treesReturned[cms] = resultObject(container);
      root.render(React.createElement('div'));
    }
    for (const cms of CMS_NAMES) {
      expect(treesReturned[cms]).toEqual({ 'landing.hero.heading': `sentinel-${cms}` });
    }
  });
});

describe('useCmsContent: slug routing', () => {
  it('passes the fixtureSlug to the adapter loadContent', async () => {
    const receivedSlugs: Array<string | undefined> = [];
    ADAPTER_IMPLS['vbrand-standalone'] = (slug) => { receivedSlugs.push(slug); return Promise.resolve({}); };
    await render('vbrand-standalone', 'vercel');
    expect(receivedSlugs).toContain('vercel');
  });

  it('passes undefined fixtureSlug to the adapter', async () => {
    const receivedSlugs: Array<string | undefined> = [];
    ADAPTER_IMPLS['vbrand-standalone'] = (slug) => { receivedSlugs.push(slug); return Promise.resolve({}); };
    await render('vbrand-standalone', undefined);
    expect(receivedSlugs).toContain(undefined);
  });

  it('different slugs for the same cms resolve to different ContentTree values', async () => {
    ADAPTER_IMPLS['payload'] = (slug) => Promise.resolve({ 'landing.hero.heading': `content-for-${slug ?? 'default'}` } as ContentTree);

    await render('payload', 'stripe');
    const stripeTree = resultObject(container);

    await rerender('payload', 'vercel');
    const vercelTree = resultObject(container);

    expect(stripeTree).not.toEqual(vercelTree);
    expect(stripeTree['landing.hero.heading' as keyof ContentTree]).toBe('content-for-stripe');
    expect(vercelTree['landing.hero.heading' as keyof ContentTree]).toBe('content-for-vercel');
  });

  it('each known fixture slug routes to the correct content', async () => {
    const FIXTURE_SLUGS = ['stripe', 'vercel', 'linear', 'notion', 'github'];
    ADAPTER_IMPLS['vbrand-standalone'] = (slug) =>
      Promise.resolve({ 'landing.hero.heading': `brand-${slug}` } as ContentTree);

    for (const slug of FIXTURE_SLUGS) {
      await rerender('vbrand-standalone', slug);
      expect(resultObject(container)['landing.hero.heading' as keyof ContentTree]).toBe(`brand-${slug}`);
    }
  });
});

describe('useCmsContent: error handling', () => {
  it('returns an empty object when the adapter rejects', async () => {
    ADAPTER_IMPLS['vbrand-standalone'] = () => Promise.reject(new Error('network error'));
    await render('vbrand-standalone');
    expect(resultObject(container)).toEqual({});
  });

  it('does not throw when the adapter rejects', async () => {
    ADAPTER_IMPLS['sanity'] = () => Promise.reject(new Error('timeout'));
    await expect(render('sanity')).resolves.not.toThrow();
  });

  it('returns an empty object after rejection even when a prior successful load populated state', async () => {
    ADAPTER_IMPLS['vbrand-standalone'] = () => Promise.resolve({ 'landing.hero.heading': 'loaded' } as ContentTree);
    await render('vbrand-standalone');
    expect(resultObject(container)).toEqual({ 'landing.hero.heading': 'loaded' });

    ADAPTER_IMPLS['payload'] = () => Promise.reject(new Error('cms down'));
    await rerender('payload');
    expect(resultObject(container)).toEqual({});
  });
});

describe('useCmsContent: probe signal (window.__vbrand_content_tree__)', () => {
  it('sets window.__vbrand_content_tree__ to the resolved ContentTree', async () => {
    const tree: ContentTree = { 'landing.hero.heading': 'probe-value' } as ContentTree;
    ADAPTER_IMPLS['vbrand-standalone'] = () => Promise.resolve(tree);
    await render('vbrand-standalone');
    expect(window.__vbrand_content_tree__).toEqual(tree);
  });

  it('sets window.__vbrand_content_tree__ to an empty object when the adapter rejects', async () => {
    ADAPTER_IMPLS['vbrand-standalone'] = () => Promise.reject(new Error('fail'));
    await render('vbrand-standalone');
    expect(window.__vbrand_content_tree__).toEqual({});
  });

  it('updates window.__vbrand_content_tree__ when cms changes', async () => {
    ADAPTER_IMPLS['vbrand-standalone'] = () => Promise.resolve({ 'landing.hero.heading': 'from-standalone' } as ContentTree);
    await render('vbrand-standalone');
    expect(window.__vbrand_content_tree__?.['landing.hero.heading' as keyof ContentTree]).toBe('from-standalone');

    ADAPTER_IMPLS['payload'] = () => Promise.resolve({ 'landing.hero.heading': 'from-payload' } as ContentTree);
    await rerender('payload');
    expect(window.__vbrand_content_tree__?.['landing.hero.heading' as keyof ContentTree]).toBe('from-payload');
  });

  it('updates window.__vbrand_content_tree__ when fixtureSlug changes', async () => {
    ADAPTER_IMPLS['vbrand-standalone'] = (slug) =>
      Promise.resolve({ 'landing.hero.heading': `brand-${slug}` } as ContentTree);

    await render('vbrand-standalone', 'stripe');
    expect(window.__vbrand_content_tree__?.['landing.hero.heading' as keyof ContentTree]).toBe('brand-stripe');

    await rerender('vbrand-standalone', 'vercel');
    expect(window.__vbrand_content_tree__?.['landing.hero.heading' as keyof ContentTree]).toBe('brand-vercel');
  });

  it('each CmsName sets the correct probe signal after adapter resolution', async () => {
    const CMS_NAMES: CmsName[] = ['vbrand-standalone', 'payload', 'sanity', 'strapi'];
    for (const cms of CMS_NAMES) {
      ADAPTER_IMPLS[cms] = () => Promise.resolve({ 'landing.hero.heading': `probe-${cms}` } as ContentTree);
      await rerender(cms);
      expect(window.__vbrand_content_tree__?.['landing.hero.heading' as keyof ContentTree]).toBe(`probe-${cms}`);
    }
  });
});

describe('useCmsContent: dependency tracking on cms change', () => {
  it('re-fetches content when cms changes from one value to another', async () => {
    ADAPTER_IMPLS['vbrand-standalone'] = () => Promise.resolve({ 'landing.hero.heading': 'standalone' } as ContentTree);
    await render('vbrand-standalone');
    expect(resultObject(container)['landing.hero.heading' as keyof ContentTree]).toBe('standalone');

    ADAPTER_IMPLS['payload'] = () => Promise.resolve({ 'landing.hero.heading': 'payload' } as ContentTree);
    await rerender('payload');
    expect(resultObject(container)['landing.hero.heading' as keyof ContentTree]).toBe('payload');
  });

  it('cycling through all CmsNames each time reflects the correct adapter result', async () => {
    const CMS_NAMES: CmsName[] = ['vbrand-standalone', 'payload', 'sanity', 'strapi'];
    for (const cms of CMS_NAMES) {
      ADAPTER_IMPLS[cms] = () => Promise.resolve({ 'landing.hero.heading': `result-${cms}` } as ContentTree);
      await rerender(cms);
      expect(resultObject(container)['landing.hero.heading' as keyof ContentTree]).toBe(`result-${cms}`);
    }
  });
});

describe('useCmsContent: dependency tracking on fixtureSlug change', () => {
  it('re-fetches when fixtureSlug changes', async () => {
    ADAPTER_IMPLS['vbrand-standalone'] = (slug) =>
      Promise.resolve({ 'landing.hero.heading': `for-${slug}` } as ContentTree);

    await render('vbrand-standalone', 'stripe');
    expect(resultObject(container)['landing.hero.heading' as keyof ContentTree]).toBe('for-stripe');

    await rerender('vbrand-standalone', 'vercel');
    expect(resultObject(container)['landing.hero.heading' as keyof ContentTree]).toBe('for-vercel');
  });

  it('re-fetches when fixtureSlug changes from defined to undefined', async () => {
    ADAPTER_IMPLS['vbrand-standalone'] = (slug) =>
      Promise.resolve({ 'landing.hero.heading': `for-${slug ?? 'default'}` } as ContentTree);

    await render('vbrand-standalone', 'stripe');
    expect(resultObject(container)['landing.hero.heading' as keyof ContentTree]).toBe('for-stripe');

    await rerender('vbrand-standalone', undefined);
    expect(resultObject(container)['landing.hero.heading' as keyof ContentTree]).toBe('for-default');
  });

  it('re-fetches when fixtureSlug changes from undefined to defined', async () => {
    ADAPTER_IMPLS['vbrand-standalone'] = (slug) =>
      Promise.resolve({ 'landing.hero.heading': `for-${slug ?? 'none'}` } as ContentTree);

    await render('vbrand-standalone', undefined);
    expect(resultObject(container)['landing.hero.heading' as keyof ContentTree]).toBe('for-none');

    await rerender('vbrand-standalone', 'linear');
    expect(resultObject(container)['landing.hero.heading' as keyof ContentTree]).toBe('for-linear');
  });
});

describe('useCmsContent: stale-load cancellation', () => {
  it('ignores a slow first load when deps change before it resolves', async () => {
    const first = deferred<ContentTree>();
    ADAPTER_IMPLS['vbrand-standalone'] = () => first.promise;

    await act(async () => {
      root.render(React.createElement(Wrapper, { cms: 'vbrand-standalone', fixtureSlug: 'stripe' }));
    });

    ADAPTER_IMPLS['payload'] = () => Promise.resolve({ 'landing.hero.heading': 'fast-payload' } as ContentTree);
    await rerender('payload');

    await act(async () => {
      first.resolve({ 'landing.hero.heading': 'stale-standalone' } as ContentTree);
    });

    expect(resultObject(container)['landing.hero.heading' as keyof ContentTree]).toBe('fast-payload');
    expect(window.__vbrand_content_tree__?.['landing.hero.heading' as keyof ContentTree]).toBe('fast-payload');
  });

  it('does not update the probe signal from a cancelled load', async () => {
    const slow = deferred<ContentTree>();
    ADAPTER_IMPLS['vbrand-standalone'] = () => slow.promise;

    await act(async () => {
      root.render(React.createElement(Wrapper, { cms: 'vbrand-standalone', fixtureSlug: 'stripe' }));
    });

    ADAPTER_IMPLS['sanity'] = () => Promise.resolve({ 'landing.hero.heading': 'current' } as ContentTree);
    await rerender('sanity');

    await act(async () => {
      slow.resolve({ 'landing.hero.heading': 'stale' } as ContentTree);
    });

    expect(window.__vbrand_content_tree__?.['landing.hero.heading' as keyof ContentTree]).toBe('current');
  });

  it('ignores a slow slug load superseded by a fast slug load for the same cms', async () => {
    const slowFirst = deferred<ContentTree>();
    ADAPTER_IMPLS['vbrand-standalone'] = (slug) => {
      if (slug === 'stripe') return slowFirst.promise;
      return Promise.resolve({ 'landing.hero.heading': `fast-${slug}` } as ContentTree);
    };

    await act(async () => {
      root.render(React.createElement(Wrapper, { cms: 'vbrand-standalone', fixtureSlug: 'stripe' }));
    });

    await rerender('vbrand-standalone', 'vercel');

    await act(async () => {
      slowFirst.resolve({ 'landing.hero.heading': 'stale-stripe' } as ContentTree);
    });

    expect(resultObject(container)['landing.hero.heading' as keyof ContentTree]).toBe('fast-vercel');
  });
});
