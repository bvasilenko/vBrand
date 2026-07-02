// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { stampVersionIntoHtml } from '../vite-html-transform.js';

const DEMO_ROOT = join(import.meta.dirname, '..');
const ROOT = join(DEMO_ROOT, '../..');
const PUBLIC_DIR = join(DEMO_ROOT, 'public');
const SOURCE_HTML = readFileSync(join(DEMO_ROOT, 'index.html'), 'utf-8');
const VERSION = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8')).version;

const ICON_LINK_RE = /<link\b([^>]*)>/g;

function parseFaviconLink(html) {
  for (const match of html.matchAll(ICON_LINK_RE)) {
    const attrs = match[1];
    if (/\brel="icon"/.test(attrs)) {
      return {
        tag: match[0],
        href: attrs.match(/\bhref="([^"]*)"/)?.[1] ?? null,
        type: attrs.match(/\btype="([^"]*)"/)?.[1] ?? null,
      };
    }
  }
  return null;
}

const MINIMAL_HTML_WITH_BOTH = [
  '<!DOCTYPE html><html><head>',
  '<title>vBrand - adaptive themed demo</title>',
  '<meta name="description" content="vBrand adaptive themed demo." />',
  '</head><body></body></html>',
].join('');

const SEMVER_RE = /\d+\.\d+\.\d+(-[a-z0-9.]+)?/i;

describe('stampVersionIntoHtml - title stamping', () => {
  it('replaces a version-free title with the versioned form', () => {
    const out = stampVersionIntoHtml('<title>vBrand - adaptive themed demo</title>', VERSION);
    expect(out).toBe(`<title>vBrand ${VERSION} - adaptive themed demo</title>`);
  });

  it('replaces a previously stamped title (idempotent repeated application)', () => {
    const once = stampVersionIntoHtml(MINIMAL_HTML_WITH_BOTH, VERSION);
    const twice = stampVersionIntoHtml(once, VERSION);
    expect(twice).toBe(once);
  });

  it('replaces a title stamped with a different version string', () => {
    const stale = stampVersionIntoHtml(MINIMAL_HTML_WITH_BOTH, '0.3.0');
    const updated = stampVersionIntoHtml(stale, VERSION);
    expect(updated).toContain(`<title>vBrand ${VERSION}`);
    expect(updated).not.toContain('0.3.0');
  });

  it('embeds the version string at the expected position within the title element', () => {
    const out = stampVersionIntoHtml(MINIMAL_HTML_WITH_BOTH, VERSION);
    const escaped = VERSION.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    expect(out).toMatch(new RegExp(`<title>vBrand ${escaped} - adaptive themed demo</title>`));
  });

  it('produces exactly one title element regardless of input version content', () => {
    const out = stampVersionIntoHtml(MINIMAL_HTML_WITH_BOTH, VERSION);
    const matches = [...out.matchAll(/<title>/g)];
    expect(matches).toHaveLength(1);
  });

  it('does not alter surrounding HTML when replacing the title', () => {
    const prefix = '<!DOCTYPE html><html><head>';
    const suffix = '<meta charset="UTF-8"/></head><body></body></html>';
    const html = `${prefix}<title>old</title>${suffix}`;
    const out = stampVersionIntoHtml(html, VERSION);
    expect(out.startsWith(prefix)).toBe(true);
    expect(out.endsWith(suffix)).toBe(true);
  });

  it('handles an HTML string with no title element without throwing', () => {
    expect(() => stampVersionIntoHtml('<html><body></body></html>', VERSION)).not.toThrow();
  });

  it('returns the string unchanged when no title element is present', () => {
    const html = '<html><body>no title here</body></html>';
    expect(stampVersionIntoHtml(html, VERSION)).toBe(html);
  });

  it('version string containing dots and hyphens is treated as a literal, not a regex', () => {
    const tricky = '0.4.0-alpha.5';
    const out = stampVersionIntoHtml(MINIMAL_HTML_WITH_BOTH, tricky);
    expect(out).toContain(`vBrand ${tricky}`);
  });
});

describe('stampVersionIntoHtml - description meta stamping', () => {
  it('stamps the version prefix into a vBrand description meta', () => {
    const out = stampVersionIntoHtml(MINIMAL_HTML_WITH_BOTH, VERSION);
    expect(out).toContain(`content="vBrand ${VERSION}`);
  });

  it('stamped description content is well-formed: starts with the versioned prefix, ends inside a double-quote boundary', () => {
    const out = stampVersionIntoHtml(MINIMAL_HTML_WITH_BOTH, VERSION);
    const descMatch = out.match(/name="description" content="([^"]*)"/);
    expect(descMatch).not.toBeNull();
    expect(descMatch?.[1]).toMatch(new RegExp(`^vBrand ${VERSION.replace(/\./g, '\\.')}`));
  });

  it('replaces a previously stamped description (idempotent repeated application)', () => {
    const once = stampVersionIntoHtml(MINIMAL_HTML_WITH_BOTH, VERSION);
    const twice = stampVersionIntoHtml(once, VERSION);
    expect(twice).toBe(once);
  });

  it('replaces a description stamped with a different version', () => {
    const stale = stampVersionIntoHtml(MINIMAL_HTML_WITH_BOTH, '0.3.0');
    const updated = stampVersionIntoHtml(stale, VERSION);
    expect(updated).toContain(`content="vBrand ${VERSION}`);
    expect(updated).not.toContain('0.3.0');
  });

  it('does not touch a description meta whose content does not start with "vBrand"', () => {
    const html = '<meta name="description" content="Some other description." />';
    expect(stampVersionIntoHtml(html, VERSION)).toBe(html);
  });

  it('handles an HTML string with no description meta without throwing', () => {
    expect(() => stampVersionIntoHtml('<html><head></head></html>', VERSION)).not.toThrow();
  });

  it('returns the string unchanged when no description meta is present', () => {
    const html = '<html><body>no meta</body></html>';
    expect(stampVersionIntoHtml(html, VERSION)).toBe(html);
  });

  it('stamped content attribute remains syntactically closed inside a double-quote boundary', () => {
    const out = stampVersionIntoHtml(MINIMAL_HTML_WITH_BOTH, VERSION);
    const descMatch = out.match(/content="([^"]*)"/);
    expect(descMatch).not.toBeNull();
  });
});

describe('stampVersionIntoHtml - combined title + description', () => {
  it('stamps both title and description in a single call', () => {
    const out = stampVersionIntoHtml(MINIMAL_HTML_WITH_BOTH, VERSION);
    expect(out).toContain(`<title>vBrand ${VERSION}`);
    expect(out).toContain(`content="vBrand ${VERSION}`);
  });

  it('title and description each contain the same version string after stamping', () => {
    const out = stampVersionIntoHtml(MINIMAL_HTML_WITH_BOTH, VERSION);
    const titleMatch = out.match(/<title>vBrand ([^ ]+)/)?.[1];
    const descMatch = out.match(/content="vBrand ([^ ]+)/)?.[1];
    expect(titleMatch).toBe(VERSION);
    expect(descMatch).toBe(VERSION);
  });

  it('the two replacements are independent: neither interferes with the other', () => {
    const onlyTitle = stampVersionIntoHtml('<title>vBrand - demo</title>', VERSION);
    const onlyDesc = stampVersionIntoHtml('<meta name="description" content="vBrand demo." />', VERSION);
    expect(onlyTitle).toContain(`<title>vBrand ${VERSION}`);
    expect(onlyDesc).toContain(`content="vBrand ${VERSION}`);
  });

  it('returns a pure string with no mutation of the input', () => {
    const original = MINIMAL_HTML_WITH_BOTH;
    stampVersionIntoHtml(original, VERSION);
    expect(MINIMAL_HTML_WITH_BOTH).toBe(original);
  });
});

describe('index.html source - favicon link element', () => {
  it('has exactly one favicon link element', () => {
    const matches = [...SOURCE_HTML.matchAll(/<link\b[^>]*\brel="icon"[^>]*>/g)];
    expect(matches).toHaveLength(1);
  });

  it('favicon link href attribute is present and non-empty', () => {
    expect(parseFaviconLink(SOURCE_HTML)?.href).toBeTruthy();
  });

  it('favicon link type attribute is image/svg+xml', () => {
    expect(parseFaviconLink(SOURCE_HTML)?.type).toBe('image/svg+xml');
  });

  it('favicon link href is an absolute path so Vite can base-rewrite it during build', () => {
    const href = parseFaviconLink(SOURCE_HTML)?.href ?? '';
    expect(href).toMatch(/^\//);
  });

  it('favicon link href is not a data-URI (Vite build silently strips data-URI icon hrefs)', () => {
    const href = parseFaviconLink(SOURCE_HTML)?.href ?? '';
    expect(href).not.toMatch(/^data:/i);
  });

  it('favicon link href is not an external URL (external URLs are base-path-dependent and CORS-limited)', () => {
    const href = parseFaviconLink(SOURCE_HTML)?.href ?? '';
    expect(href).not.toMatch(/^https?:\/\//i);
  });

  it('favicon link href extension is consistent with the declared type attribute', () => {
    const link = parseFaviconLink(SOURCE_HTML);
    const ext = link?.href?.split('.').pop()?.toLowerCase();
    if (link?.type === 'image/svg+xml') {
      expect(ext).toBe('svg');
    } else if (link?.type === 'image/png') {
      expect(ext).toBe('png');
    } else if (link?.type === 'image/x-icon') {
      expect(['ico', 'icon']).toContain(ext);
    }
  });
});

describe('index.html source - favicon link: transform stability', () => {
  it('stampVersionIntoHtml preserves the favicon link element', () => {
    const stamped = stampVersionIntoHtml(SOURCE_HTML, VERSION);
    expect(parseFaviconLink(stamped)).not.toBeNull();
  });

  it('stampVersionIntoHtml does not alter the favicon link href', () => {
    const originalHref = parseFaviconLink(SOURCE_HTML)?.href;
    const stamped = stampVersionIntoHtml(SOURCE_HTML, VERSION);
    expect(parseFaviconLink(stamped)?.href).toBe(originalHref);
  });

  it('stampVersionIntoHtml does not alter the favicon link type attribute', () => {
    const originalType = parseFaviconLink(SOURCE_HTML)?.type;
    const stamped = stampVersionIntoHtml(SOURCE_HTML, VERSION);
    expect(parseFaviconLink(stamped)?.type).toBe(originalType);
  });

  it('repeated stampVersionIntoHtml applications do not duplicate the favicon link', () => {
    const once = stampVersionIntoHtml(SOURCE_HTML, VERSION);
    const twice = stampVersionIntoHtml(once, VERSION);
    const matches = [...twice.matchAll(/<link\b[^>]*\brel="icon"[^>]*>/g)];
    expect(matches).toHaveLength(1);
  });

  it('stampVersionIntoHtml is idempotent with respect to the favicon link href', () => {
    const once = stampVersionIntoHtml(SOURCE_HTML, VERSION);
    const twice = stampVersionIntoHtml(once, VERSION);
    expect(parseFaviconLink(twice)?.href).toBe(parseFaviconLink(once)?.href);
  });
});

describe('public/ directory - favicon SVG asset', () => {
  const sourceHref = parseFaviconLink(SOURCE_HTML)?.href ?? '';
  const publicPath = join(PUBLIC_DIR, sourceHref.replace(/^\//, ''));

  it('the file referenced by the favicon href exists in public/', () => {
    expect(existsSync(publicPath)).toBe(true);
  });

  it('the favicon file contains an <svg> element', () => {
    const content = readFileSync(publicPath, 'utf-8');
    expect(content).toMatch(/<svg\b/i);
  });

  it('the favicon SVG declares the XML namespace required for standalone serving', () => {
    const content = readFileSync(publicPath, 'utf-8');
    expect(content).toMatch(/\bxmlns=/);
  });

  it('the favicon SVG has a viewBox attribute for resolution-independent scaling', () => {
    const content = readFileSync(publicPath, 'utf-8');
    expect(content).toMatch(/\bviewBox=/i);
  });

  it('the favicon SVG contains no <script> elements', () => {
    const content = readFileSync(publicPath, 'utf-8');
    expect(content).not.toMatch(/<script\b/i);
  });

  it('the favicon SVG closes the root <svg> element', () => {
    const content = readFileSync(publicPath, 'utf-8');
    expect(content).toMatch(/<\/svg>/i);
  });
});

describe('index.html source - version-free contract', () => {
  it('source title element contains no semver version string', () => {
    const titleMatch = SOURCE_HTML.match(/<title>([^<]*)<\/title>/);
    expect(titleMatch).not.toBeNull();
    expect(titleMatch?.[1] ?? '').not.toMatch(SEMVER_RE);
  });

  it('source description meta content contains no semver version string', () => {
    const descMatch = SOURCE_HTML.match(/name="description" content="([^"]*)"/);
    expect(descMatch).not.toBeNull();
    expect(descMatch?.[1] ?? '').not.toMatch(SEMVER_RE);
  });

  it('source title element is present for the plugin to transform', () => {
    expect(SOURCE_HTML).toMatch(/<title>[^<]+<\/title>/);
  });

  it('source description meta is present for the plugin to transform', () => {
    expect(SOURCE_HTML).toMatch(/name="description" content="vBrand/);
  });

  it('stampVersionIntoHtml applied to source html injects version into title', () => {
    const out = stampVersionIntoHtml(SOURCE_HTML, VERSION);
    expect(out).toContain(`<title>vBrand ${VERSION}`);
  });

  it('stampVersionIntoHtml applied to source html injects version into description', () => {
    const out = stampVersionIntoHtml(SOURCE_HTML, VERSION);
    expect(out).toContain(`content="vBrand ${VERSION}`);
  });
});
