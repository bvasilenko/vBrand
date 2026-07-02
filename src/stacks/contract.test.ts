// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { describe, expect, it } from 'vitest';
import { parse } from 'node-html-parser';
import { markIsland } from '../interactivity/islands.js';
import { DEFAULT_STACK, getStackRuntime, parseStack, STACK_RUNTIME_REGISTRY, STACK_NAMES } from './index.js';
import { STACK_PREVIEW_VERSION, stackPreviewLabel } from './preview-html.js';
import type { StackName } from './types.js';

const DEFAULTS = { vite: 'spa', next: 'hybrid', astro: 'static' } as const;
const MARKERS = {
  vite: ['__VBRAND_VITE_BOOTSTRAP_PREVIEW__', 'spa-bootstrap-preview'],
  next: ['__NEXT_DATA__', 'client-hydrate-preview'],
  astro: ['<astro-island', 'data-astro-component-hydration'],
} as const;
const PROOF_SELECTORS = {
  vite: '#__VBRAND_STACK_PREVIEW__',
  next: '#__NEXT_DATA__',
  astro: 'astro-island',
} as const;
const SPECIAL_TEXT = 'Quoted "font" and </script> marker';

function composedTree() {
  return React.createElement(
    'section',
    null,
    React.createElement('h1', null, 'Alpha preview'),
    React.createElement('p', null, SPECIAL_TEXT),
    markIsland(React.createElement('p', null, 'Shared island'), 'shared-island'),
  );
}

function textOf(html: string): string {
  return parse(html).textContent.replace(/\s+/g, ' ').trim();
}

function scriptJson(html: string, selector: string): unknown {
  const script = parse(html).querySelector(selector);
  expect(script).not.toBeNull();
  return JSON.parse(script?.rawText ?? '{}');
}

function expectTextProof(value: string) {
  const decoded = value.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  expect(decoded).toContain('Alpha preview');
  expect(decoded).toContain(SPECIAL_TEXT);
  expect(decoded).toContain('Shared island');
}

function htmlFor(name: StackName, node: React.ReactNode = composedTree()): string {
  return STACK_RUNTIME_REGISTRY[name].bootstrapMarkup(node);
}

describe('StackRuntime contract', () => {
  it('keeps registry keys, runtime names, and default modes aligned', () => {
    expect(Object.keys(STACK_RUNTIME_REGISTRY).sort()).toEqual([...STACK_NAMES].sort());
    for (const name of STACK_NAMES) {
      const runtime = STACK_RUNTIME_REGISTRY[name];
      expect(runtime.name()).toBe(name);
      expect(runtime.defaultMode()).toBe(DEFAULTS[name]);
    }
  });

  it('parses invalid stack input to the documented default', () => {
    expect(parseStack(null)).toBe(DEFAULT_STACK);
    expect(parseStack(undefined)).toBe(DEFAULT_STACK);
    expect(parseStack('remix')).toBe(DEFAULT_STACK);
    expect(parseStack('astro')).toBe('astro');
  });

  it('preserves composed text across every preview shape', () => {
    for (const runtime of Object.values(STACK_RUNTIME_REGISTRY)) {
      expectTextProof(textOf(runtime.bootstrapMarkup(composedTree())));
    }
  });

  it('emits stack-specific preview markers without requiring live framework servers', () => {
    for (const name of STACK_NAMES) {
      const html = htmlFor(name);
      for (const marker of MARKERS[name]) expect(html).toContain(marker);
      const meta = scriptJson(html, '#__VBRAND_STACK_ARTEFACT__') as { stack: string; version: string; artefact: string; shape: string };
      expect(meta.stack).toBe(name);
      expect(meta.version).toBe(STACK_PREVIEW_VERSION);
      expect(meta.artefact).toBe(`dist/stacks/${name}.html`);
      expect(meta.shape).toContain('not a live');
      const root = parse(html);
      const labels = root.querySelectorAll('[data-stack-preview-label]');
      expect(labels).toHaveLength(1);
      const label = labels[0];
      expect(label?.textContent).toContain('not a live');
      expect(label?.textContent).toBe(meta.shape);
    }
  });

  it('keeps preview markers inert and script-safe for every stack document', () => {
    for (const name of STACK_NAMES) {
      const root = parse(htmlFor(name));
      expect(root.querySelectorAll('script[type="module"]')).toHaveLength(0);
      expect(root.querySelectorAll('script:not([type="application/json"])')).toHaveLength(0);
      for (const script of root.querySelectorAll('script')) expect(script.rawText).not.toContain('</script> marker');
    }
  });

  it('exposes one stable proof surface for every supported stack', () => {
    for (const name of STACK_NAMES) {
      expect(parse(htmlFor(name)).querySelector(PROOF_SELECTORS[name])).not.toBeNull();
    }
  });

  it('exposes stable stack proof data without depending only on internal runtime markers', () => {
    const proof: Record<StackName, () => void> = {
      vite: () => {
        const html = STACK_RUNTIME_REGISTRY.vite.bootstrapMarkup(composedTree());
        const payload = scriptJson(html, '#__VBRAND_STACK_PREVIEW__') as { stack: string; textContent: string };
        expect(payload.stack).toBe('vite');
        expectTextProof(payload.textContent);
      },
      next: () => {
        const html = STACK_RUNTIME_REGISTRY.next.bootstrapMarkup(composedTree());
        const pageData = scriptJson(html, '#__NEXT_DATA__') as { props: { stack: string; textContent: string; islands: string[] } };
        expect(pageData.props.stack).toBe('next');
        expectTextProof(pageData.props.textContent);
        expect(pageData.props.islands).toEqual(['shared-island']);
      },
      astro: () => {
        const root = parse(STACK_RUNTIME_REGISTRY.astro.bootstrapMarkup(composedTree()));
        const island = root.querySelector('astro-island');
        expect(island?.getAttribute('uid')).toBe('shared-island');
        expect(root.querySelectorAll('script[data-astro-component-hydration]')).toHaveLength(1);
      },
    };

    for (const name of STACK_NAMES) proof[name]();
  });

  it('keeps Astro zero-JS pages valid by emitting a deterministic island fallback only when no island is present', () => {
    const root = parse(htmlFor('astro', React.createElement('section', null, React.createElement('h1', null, 'No island'))));
    expect(root.querySelector('main')?.textContent).toContain('No island');
    expect(root.querySelector('astro-island')?.getAttribute('uid')).toBe('vbrand-preview-island');
    expect(root.querySelectorAll('script[data-astro-component-hydration]')).toHaveLength(1);
  });
});

describe('StackRuntime parser and registry contract', () => {
  it('parseStack accepts every member of STACK_NAMES verbatim', () => {
    for (const name of STACK_NAMES) expect(parseStack(name)).toBe(name);
  });

  it('parseStack is case-sensitive: uppercase and mixed-case values fall back to DEFAULT_STACK', () => {
    for (const bad of ['Vite', 'NEXT', 'Astro', 'VITE', 'Next']) {
      expect(parseStack(bad)).toBe(DEFAULT_STACK);
    }
  });

  it('DEFAULT_STACK is vite', () => {
    expect(DEFAULT_STACK).toBe('vite');
  });

  it('STACK_NAMES contains exactly vite, next, astro and no other values', () => {
    expect([...STACK_NAMES].sort()).toEqual(['astro', 'next', 'vite']);
    expect(STACK_NAMES).toHaveLength(3);
  });

  it('getStackRuntime returns the named adapter for every valid stack', () => {
    for (const name of STACK_NAMES) expect(getStackRuntime(name).name()).toBe(name);
  });

  it('emitted HTML documents carry a lang="en" root and utf-8 charset across every stack', () => {
    for (const name of STACK_NAMES) {
      const root = parse(htmlFor(name));
      expect(root.querySelector('html')?.getAttribute('lang')).toBe('en');
      expect(root.querySelector('meta[charset]')?.getAttribute('charset')).toBe('utf-8');
    }
  });

  it('Astro emits a distinct astro-island element for each unique island in the composed tree', () => {
    const multiIsland = React.createElement(
      'section',
      null,
      markIsland(React.createElement('p', null, 'island A'), 'island-a'),
      markIsland(React.createElement('p', null, 'island B'), 'island-b'),
    );
    const root = parse(STACK_RUNTIME_REGISTRY.astro.bootstrapMarkup(multiIsland));
    const islands = root.querySelectorAll('astro-island');
    expect(islands).toHaveLength(2);
    expect(islands[0]?.getAttribute('uid')).toBe('island-a');
    expect(islands[1]?.getAttribute('uid')).toBe('island-b');
  });

  it('STACK_PREVIEW_VERSION is a non-empty semver string shared by all artefact documents', () => {
    expect(STACK_PREVIEW_VERSION).toMatch(/^\d+\.\d+\.\d+/);
    for (const name of STACK_NAMES) {
      const meta = scriptJson(htmlFor(name), '#__VBRAND_STACK_ARTEFACT__') as { version: string };
      expect(meta.version).toBe(STACK_PREVIEW_VERSION);
    }
  });

  it('STACK_PREVIEW_VERSION matches the package.json version', () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8')) as { version: string };
    expect(STACK_PREVIEW_VERSION).toBe(pkg.version);
  });
});

describe('stackPreviewLabel', () => {
  it('returns a footer element carrying the data-stack-preview-label attribute', () => {
    const html = stackPreviewLabel('Vite SPA shape');
    const root = parse(html);
    const footer = root.querySelector('footer[data-stack-preview-label]');
    expect(footer).not.toBeNull();
  });

  it('embeds the shape string verbatim as text content', () => {
    const shape = 'Astro island preview shape, not a live Astro build';
    const html = stackPreviewLabel(shape);
    expect(parse(html).querySelector('[data-stack-preview-label]')?.textContent).toBe(shape);
  });

  it('HTML-escapes special characters in the shape string', () => {
    const html = stackPreviewLabel('<script>alert(1)</script>');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('produces distinct output for distinct shape inputs', () => {
    const a = stackPreviewLabel('Vite SPA shape');
    const b = stackPreviewLabel('Next page-data shape');
    expect(a).not.toBe(b);
  });

  it('produces consistent output for the same input on repeated calls', () => {
    const shape = 'Astro island preview shape, not a live Astro build';
    expect(stackPreviewLabel(shape)).toBe(stackPreviewLabel(shape));
  });
});

describe('parseStack - non-string and boundary inputs', () => {
  it('empty string falls back to DEFAULT_STACK', () => {
    expect(parseStack('')).toBe(DEFAULT_STACK);
  });

  it('numeric input falls back to DEFAULT_STACK', () => {
    expect(parseStack(0 as unknown as string)).toBe(DEFAULT_STACK);
    expect(parseStack(1 as unknown as string)).toBe(DEFAULT_STACK);
  });

  it('boolean input falls back to DEFAULT_STACK', () => {
    expect(parseStack(true as unknown as string)).toBe(DEFAULT_STACK);
    expect(parseStack(false as unknown as string)).toBe(DEFAULT_STACK);
  });

  it('array input falls back to DEFAULT_STACK', () => {
    expect(parseStack([] as unknown as string)).toBe(DEFAULT_STACK);
    expect(parseStack(['vite'] as unknown as string)).toBe(DEFAULT_STACK);
  });
});
