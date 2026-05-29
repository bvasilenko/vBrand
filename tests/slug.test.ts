// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { describe, expect, it } from 'vitest';
import { sourceToSlug } from '../src/lib/pull/slug.js';

const SLUG_SAFE_RE = /^[a-z0-9-]+$/;

describe('sourceToSlug - output invariants', () => {
  it('output contains only lowercase alphanumerics and hyphens', () => {
    const samples = [
      'https://example.com',
      'gh:my-user',
      'npm:@scope/my-pkg',
      'https://www.example.com/path/to/page',
      './local/file.json',
    ];
    for (const s of samples) {
      expect(sourceToSlug(s)).toMatch(SLUG_SAFE_RE);
    }
  });

  it('output never starts or ends with a hyphen', () => {
    const samples = [
      'https://example.com',
      'gh:handle',
      'npm:pkg',
      'https://example.com/',
    ];
    for (const s of samples) {
      const slug = sourceToSlug(s);
      expect(slug[0]).not.toBe('-');
      expect(slug[slug.length - 1]).not.toBe('-');
    }
  });

  it('is deterministic: same input always produces the same slug', () => {
    const input = 'https://astro.build';
    expect(sourceToSlug(input)).toBe(sourceToSlug(input));
  });

  it('output length does not exceed 80 characters', () => {
    const veryLong = 'https://very-long-hostname-that-exceeds-normal-length.example.com/a/very/long/path/segment/here';
    expect(sourceToSlug(veryLong).length).toBeLessThanOrEqual(80);
  });
});

describe('sourceToSlug - locator-type prefixes', () => {
  it('gh:<handle> starts with "gh-"', () => {
    expect(sourceToSlug('gh:myuser')).toMatch(/^gh-/);
  });

  it('npm:<package> starts with "npm-"', () => {
    expect(sourceToSlug('npm:my-package')).toMatch(/^npm-/);
  });

  it('https:// URL produces host-based slug without protocol prefix', () => {
    const slug = sourceToSlug('https://example.com');
    expect(slug).not.toMatch(/^https/);
    expect(slug).toContain('example');
  });

  it('http:// URL is treated the same as https://', () => {
    const http = sourceToSlug('http://example.com');
    const https = sourceToSlug('https://example.com');
    expect(http).toBe(https);
  });

  it('local path starts with "local-"', () => {
    expect(sourceToSlug('./my-schema.json')).toMatch(/^local-/);
  });
});

describe('sourceToSlug - URL host disambiguation', () => {
  it('www.foo.com and foo.com produce different slugs', () => {
    expect(sourceToSlug('https://www.foo.com')).not.toBe(sourceToSlug('https://foo.com'));
  });

  it('subdomain.foo.com and foo.com produce different slugs', () => {
    expect(sourceToSlug('https://sub.foo.com')).not.toBe(sourceToSlug('https://foo.com'));
  });

  it('two different hosts always produce different slugs', () => {
    expect(sourceToSlug('https://astro.build')).not.toBe(sourceToSlug('https://remix.run'));
  });
});

describe('sourceToSlug - URL path handling', () => {
  it('root path (/) does not add a trailing segment', () => {
    const withRoot = sourceToSlug('https://example.com/');
    const bare = sourceToSlug('https://example.com');
    expect(withRoot).toBe(bare);
  });

  it('URL with path includes path in the slug', () => {
    const withPath = sourceToSlug('https://example.com/brand');
    expect(withPath).toContain('brand');
  });

  it('path separators become hyphens', () => {
    const slug = sourceToSlug('https://example.com/a/b');
    expect(slug).not.toContain('/');
  });
});

describe('sourceToSlug - character normalization', () => {
  it('uppercase letters in the host are lowercased', () => {
    const slug = sourceToSlug('https://Example.COM');
    expect(slug).toBe(slug.toLowerCase());
  });

  it('dots in the hostname become hyphens', () => {
    const slug = sourceToSlug('https://my.site.example.com');
    expect(slug).not.toContain('.');
    expect(slug).toContain('-');
  });

  it('scoped npm package name produces a valid slug', () => {
    const slug = sourceToSlug('npm:@scope/my-lib');
    expect(slug).toMatch(SLUG_SAFE_RE);
    expect(slug).toContain('scope');
    expect(slug).toContain('my');
  });

  it('gh handle with hyphen produces valid slug', () => {
    const slug = sourceToSlug('gh:my-handle-123');
    expect(slug).toMatch(SLUG_SAFE_RE);
    expect(slug).toContain('my');
  });
});

describe('sourceToSlug - specific known values', () => {
  it.each([
    ['https://astro.build',    'astro-build' ],
    ['gh:octocat',             'gh-octocat'  ],
    ['npm:react',              'npm-react'   ],
  ])('%s → %s', (input, expected) => {
    expect(sourceToSlug(input)).toBe(expected);
  });
});
