// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

type LoadStackEmitShapes = (distDir: string) => Record<string, string[]>;

let STACKS: string[];
let loadStackEmitShapes: LoadStackEmitShapes;

beforeAll(async () => {
  const axes = await vi.importActual<{ STACKS: string[] }>('../../../scripts/eye-test/axes.mjs');
  ({ STACKS } = axes);
  const mod = await vi.importActual<{ loadStackEmitShapes: LoadStackEmitShapes }>(
    '../../../scripts/eye-test/stack-snippets.mjs',
  );
  ({ loadStackEmitShapes } = mod);
});

let tmpDir: string;
let stacksDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vbrand-snippets-'));
  stacksDir = path.join(tmpDir, 'stacks');
  fs.mkdirSync(stacksDir);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true });
});

function writeStack(stack: string, html: string): void {
  fs.writeFileSync(path.join(stacksDir, `${stack}.html`), html);
}

function viteHtml(content: string): string {
  return `<html><body><script id="__VBRAND_VITE_BOOTSTRAP_PREVIEW__">${content}</script></body></html>`;
}

function nextHtml(page: string, buildId: string, islands: string[], flight: string): string {
  const data = JSON.stringify({ page, buildId, props: { islands } });
  return (
    `<html><body>` +
    `<script id="__NEXT_DATA__">${data}</script>` +
    `<script data-next-flight-preview>${flight}</script>` +
    `</body></html>`
  );
}

function astroHtml(attrs: string, hydration: string): string {
  return (
    `<html><body><astro-island ${attrs}>` +
    `<script data-astro-component-hydration>${hydration}</script>` +
    `</astro-island></body></html>`
  );
}

const EMPTY_HTML = '<html><body></body></html>';

describe('loadStackEmitShapes - output shape', () => {
  it('returns an object keyed by every STACKS value', () => {
    const shapes = loadStackEmitShapes('/nonexistent/path');
    expect(Object.keys(shapes).sort()).toEqual([...STACKS].sort());
  });

  it('all values are arrays', () => {
    const shapes = loadStackEmitShapes('/nonexistent/path');
    for (const stack of STACKS) {
      expect(Array.isArray(shapes[stack])).toBe(true);
    }
  });

  it('all values are non-empty arrays of strings', () => {
    const shapes = loadStackEmitShapes('/nonexistent/path');
    for (const stack of STACKS) {
      expect(shapes[stack].length).toBeGreaterThan(0);
      for (const line of shapes[stack]) {
        expect(typeof line).toBe('string');
      }
    }
  });
});

describe('loadStackEmitShapes - missing file fallback', () => {
  it('missing distDir produces at least two lines per stack (path hint + marker)', () => {
    const shapes = loadStackEmitShapes('/nonexistent/path');
    for (const stack of STACKS) {
      expect(shapes[stack].length).toBeGreaterThanOrEqual(2);
    }
  });

  it('missing file fallback for each stack references its stack name in a path hint', () => {
    const shapes = loadStackEmitShapes('/nonexistent/path');
    for (const stack of STACKS) {
      expect(shapes[stack].join('\n')).toContain(stack);
    }
  });

  it('missing file fallback for each stack contains a "(not found" marker', () => {
    const shapes = loadStackEmitShapes('/nonexistent/path');
    for (const stack of STACKS) {
      expect(shapes[stack].join('\n')).toContain('(not found');
    }
  });

  it('fallbacks for different stacks are distinct (each names its own stack)', () => {
    const shapes = loadStackEmitShapes('/nonexistent/path');
    const texts = STACKS.map((s) => shapes[s].join('\n'));
    const uniq = new Set(texts);
    expect(uniq.size).toBe(STACKS.length);
  });
});

describe('loadStackEmitShapes - vite extractor', () => {
  it('output starts with a script tag containing the VBRAND_VITE_BOOTSTRAP_PREVIEW id', () => {
    writeStack('vite', viteHtml('{}'));
    const lines = loadStackEmitShapes(tmpDir)['vite'];
    expect(lines[0]).toContain('<script');
    expect(lines[0]).toContain('__VBRAND_VITE_BOOTSTRAP_PREVIEW__');
  });

  it('output ends with a closing </script> tag', () => {
    writeStack('vite', viteHtml('{}'));
    const lines = loadStackEmitShapes(tmpDir)['vite'];
    expect(lines[lines.length - 1]).toContain('</script>');
  });

  it('inner content from the script element appears in the extracted lines', () => {
    writeStack('vite', viteHtml('{"theme":"dark","fixture":"stripe"}'));
    expect(loadStackEmitShapes(tmpDir)['vite'].join('\n')).toContain('{"theme":"dark","fixture":"stripe"}');
  });

  it('absent script element produces "(not found)" in the inner content', () => {
    writeStack('vite', EMPTY_HTML);
    expect(loadStackEmitShapes(tmpDir)['vite'].join('\n')).toContain('(not found)');
  });

  it('opening and closing script tag markers are always present even when content is empty', () => {
    writeStack('vite', viteHtml(''));
    const text = loadStackEmitShapes(tmpDir)['vite'].join('\n');
    expect(text).toContain('<script');
    expect(text).toContain('</script>');
  });
});

describe('loadStackEmitShapes - next extractor', () => {
  it('output includes the __NEXT_DATA__ script tag marker', () => {
    writeStack('next', nextHtml('/', 'build-1', [], 'f'));
    expect(loadStackEmitShapes(tmpDir)['next'].join('\n')).toContain('<script id="__NEXT_DATA__">');
  });

  it('extracts the page value from __NEXT_DATA__', () => {
    writeStack('next', nextHtml('/home', 'b1', [], 'f'));
    expect(loadStackEmitShapes(tmpDir)['next'].join('\n')).toContain('"page":"/home"');
  });

  it('extracts the buildId value from __NEXT_DATA__', () => {
    writeStack('next', nextHtml('/', 'xyz-build', [], 'f'));
    expect(loadStackEmitShapes(tmpDir)['next'].join('\n')).toContain('"buildId":"xyz-build"');
  });

  it('extracts island IDs from __NEXT_DATA__ props.islands', () => {
    writeStack('next', nextHtml('/', 'b1', ['HeroIsland', 'NavIsland'], 'f'));
    const text = loadStackEmitShapes(tmpDir)['next'].join('\n');
    expect(text).toContain('"HeroIsland"');
    expect(text).toContain('"NavIsland"');
  });

  it('includes the flight preview script when data-next-flight-preview is present', () => {
    writeStack('next', nextHtml('/', 'b1', [], 'flight-payload'));
    expect(loadStackEmitShapes(tmpDir)['next'].join('\n')).toContain('flight-payload');
  });

  it('absent __NEXT_DATA__ script produces "(not found)" in the output', () => {
    writeStack('next', EMPTY_HTML);
    expect(loadStackEmitShapes(tmpDir)['next'].join('\n')).toContain('(not found)');
  });

  it('flight preview content is truncated to at most 60 characters', () => {
    const long = 'X'.repeat(100);
    writeStack('next', nextHtml('/', 'b1', [], long));
    const text = loadStackEmitShapes(tmpDir)['next'].join('\n');
    expect(text).not.toContain('X'.repeat(61));
  });
});

describe('loadStackEmitShapes - astro extractor', () => {
  it('output includes an "<astro-island" opening line', () => {
    writeStack('astro', astroHtml('uid="test"', '{}'));
    const lines = loadStackEmitShapes(tmpDir)['astro'];
    expect(lines.some((l) => l.includes('<astro-island'))).toBe(true);
  });

  it('extracts attribute values from the astro-island opening tag', () => {
    writeStack('astro', astroHtml('uid="abc" component-url="/Hero.js"', '{}'));
    const text = loadStackEmitShapes(tmpDir)['astro'].join('\n');
    expect(text).toContain('uid="abc"');
    expect(text).toContain('component-url="/Hero.js"');
  });

  it('each attribute appears on its own separately indented line', () => {
    writeStack('astro', astroHtml('uid="x" renderer-url="/r.js" component-url="/c.js"', '{}'));
    const indented = loadStackEmitShapes(tmpDir)['astro'].filter((l) => l.startsWith('  '));
    expect(indented.length).toBeGreaterThanOrEqual(3);
  });

  it('extracts content from the data-astro-component-hydration script', () => {
    writeStack('astro', astroHtml('uid="x"', '{"componentUrl":"/HeroIsland.js"}'));
    expect(loadStackEmitShapes(tmpDir)['astro'].join('\n')).toContain('{"componentUrl":"/HeroIsland.js"}');
  });

  it('absent hydration script produces "(not found)" in the output', () => {
    writeStack('astro', '<html><body><astro-island uid="x"></astro-island></body></html>');
    expect(loadStackEmitShapes(tmpDir)['astro'].join('\n')).toContain('(not found)');
  });

  it('absent astro-island tag produces lines with no attribute lines', () => {
    writeStack('astro', EMPTY_HTML);
    const lines = loadStackEmitShapes(tmpDir)['astro'];
    expect(lines.some((l) => l.includes('<astro-island'))).toBe(true);
    expect(lines.some((l) => l.startsWith('  '))).toBe(false);
  });
});

describe('loadStackEmitShapes - determinism', () => {
  it('produces identical results on repeated calls with the same distDir', () => {
    writeStack('vite', viteHtml('{"v":1}'));
    writeStack('next', nextHtml('/', 'id', [], 'f'));
    writeStack('astro', astroHtml('uid="a"', '{}'));
    const first = JSON.stringify(loadStackEmitShapes(tmpDir));
    const second = JSON.stringify(loadStackEmitShapes(tmpDir));
    expect(first).toBe(second);
  });
});
