// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { describe, it, expect } from 'vitest';
import { stackArtefactUrl } from '../src/render-area.js';
import type { StackName } from '../src/router.js';

const STACK_NAMES: readonly StackName[] = ['vite', 'next', 'astro'];

describe('stackArtefactUrl - base path normalisation', () => {
  it.each(STACK_NAMES)(
    'produces stacks/%s.html under a base without a trailing slash',
    (stack) => {
      expect(stackArtefactUrl('/base', stack)).toBe(`/base/stacks/${stack}.html`);
    },
  );

  it.each(STACK_NAMES)(
    'produces stacks/%s.html under a base that already has a trailing slash',
    (stack) => {
      expect(stackArtefactUrl('/base/', stack)).toBe(`/base/stacks/${stack}.html`);
    },
  );

  it('does not double the slash when base ends with a slash', () => {
    const url = stackArtefactUrl('/root/', 'vite');
    expect(url).not.toContain('//stacks');
  });

  it('adds exactly one slash when base lacks a trailing slash', () => {
    const url = stackArtefactUrl('/root', 'vite');
    expect(url).toContain('/root/stacks/');
    expect(url).not.toContain('/root//stacks/');
  });
});

describe('stackArtefactUrl - URL structure', () => {
  it.each(STACK_NAMES)(
    'URL ends with .html for stack "%s"',
    (stack) => {
      expect(stackArtefactUrl('/', stack)).toMatch(/\.html$/);
    },
  );

  it.each(STACK_NAMES)(
    'URL contains the exact stack name "%s" as a path segment',
    (stack) => {
      const url = stackArtefactUrl('/demo', stack);
      expect(url).toContain(`/stacks/${stack}.html`);
    },
  );

  it.each(STACK_NAMES)(
    'absolute http base produces an absolute URL for stack "%s"',
    (stack) => {
      const url = stackArtefactUrl('https://example.com/vbrand', stack);
      expect(url).toBe(`https://example.com/vbrand/stacks/${stack}.html`);
    },
  );

  it.each(STACK_NAMES)(
    'root base "/" produces "/stacks/%s.html"',
    (stack) => {
      expect(stackArtefactUrl('/', stack)).toBe(`/stacks/${stack}.html`);
    },
  );
});

describe('stackArtefactUrl - all (base, stack) combinations', () => {
  const BASES = ['/', '/demo', '/demo/', 'https://example.com/vbrand', 'https://example.com/vbrand/'];

  it.each(
    BASES.flatMap((base) => STACK_NAMES.map((stack) => [base, stack] as [string, StackName])),
  )(
    'returns a string ending with stacks/%s.html for base="%s"',
    (base, stack) => {
      const url = stackArtefactUrl(base, stack);
      expect(url).toMatch(new RegExp(`stacks/${stack}\\.html$`));
    },
  );

  it('results for different stacks on the same base are all distinct', () => {
    const urls = STACK_NAMES.map((stack) => stackArtefactUrl('/demo', stack));
    expect(new Set(urls).size).toBe(STACK_NAMES.length);
  });

  it('trailing-slash and non-trailing-slash bases produce the same URL', () => {
    for (const stack of STACK_NAMES) {
      expect(stackArtefactUrl('/demo', stack)).toBe(stackArtefactUrl('/demo/', stack));
    }
  });
});
