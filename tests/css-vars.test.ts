// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { emitCssVars } from '../src/lib/emit/css-vars.js';
import type { VbrandType } from '../src/schema.js';

const dirs: string[] = [];
afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });

const BASE_SCHEMA = {
  name: 'acme',
  voice: { canonical: 'Minimal brand.', repoDescription: 'Acme.' },
  assets: {
    favicon: { source: 'logo.png', sizes: [32] },
    og: { dimensions: [1200, 630] as [number, number] },
    icons: { source: 'icons/', set: [] },
  },
  tokens: {
    color: { primary: '#0f172a', accent: '#6366f1' },
    type: { sans: 'Inter, sans-serif', mono: 'JetBrains Mono, monospace' },
  },
};

function emitAndRead(schema: VbrandType): string {
  const dir = mkdtempSync(join(tmpdir(), 'vbrand-css-'));
  dirs.push(dir);
  emitCssVars(schema, dir);
  return readFileSync(join(dir, 'brand-tokens.css'), 'utf-8');
}

describe('emitCssVars - output file', () => {
  it('writes to brand-tokens.css and returns its path', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vbrand-css-'));
    dirs.push(dir);
    const outPath = emitCssVars(BASE_SCHEMA, dir);
    expect(outPath).toMatch(/brand-tokens\.css$/);
    expect(() => readFileSync(outPath, 'utf-8')).not.toThrow();
  });

  it('output ends with a single newline', () => {
    const css = emitAndRead(BASE_SCHEMA);
    expect(css.endsWith('\n')).toBe(true);
  });

  it('is deterministic: identical schema produces identical output', () => {
    const dir1 = mkdtempSync(join(tmpdir(), 'vbrand-css-'));
    dirs.push(dir1);
    const dir2 = mkdtempSync(join(tmpdir(), 'vbrand-css-'));
    dirs.push(dir2);
    emitCssVars(BASE_SCHEMA, dir1);
    emitCssVars(BASE_SCHEMA, dir2);
    expect(readFileSync(join(dir1, 'brand-tokens.css'), 'utf-8')).toBe(
      readFileSync(join(dir2, 'brand-tokens.css'), 'utf-8'),
    );
  });
});

describe('emitCssVars - :root block', () => {
  it('emits :root block with --vb- prefixed color variables', () => {
    const css = emitAndRead(BASE_SCHEMA);
    expect(css).toContain(':root {');
    expect(css).toContain('--vb-primary: #0f172a;');
    expect(css).toContain('--vb-accent: #6366f1;');
  });

  it('emits type tokens with --vb-font- prefix', () => {
    const css = emitAndRead(BASE_SCHEMA);
    expect(css).toContain('--vb-font-sans: Inter, sans-serif;');
    expect(css).toContain('--vb-font-mono: JetBrains Mono, monospace;');
  });
});

describe('emitCssVars - variable name sanitisation', () => {
  it('converts spaces in token keys to hyphens', () => {
    const schema = {
      ...BASE_SCHEMA,
      tokens: { color: { 'my color': '#ff0000' }, type: {} },
    } as VbrandType;
    const css = emitAndRead(schema);
    expect(css).toContain('--vb-my-color: #ff0000;');
  });

  it('collapses consecutive hyphens in generated var name', () => {
    const schema = {
      ...BASE_SCHEMA,
      tokens: { color: { 'a--b': '#abc123' }, type: {} },
    } as VbrandType;
    const css = emitAndRead(schema);
    expect(css).toContain('--vb-a-b: #abc123;');
  });

  it('converts to lowercase', () => {
    const schema = {
      ...BASE_SCHEMA,
      tokens: { color: { BrandPrimary: '#111111' }, type: {} },
    } as VbrandType;
    const css = emitAndRead(schema);
    expect(css).toContain('--vb-brandprimary: #111111;');
  });
});

describe('emitCssVars - theme registry blocks', () => {
  it('emits no theme blocks when schema has no themes', () => {
    const css = emitAndRead(BASE_SCHEMA);
    expect(css).not.toContain('[data-theme=');
  });

  it('uses ":root, [data-theme=\\"light\\"]" selector for light mode', () => {
    const schema = {
      ...BASE_SCHEMA,
      themes: {
        modes: ['light'],
        registry: { light: { primary: '#ffffff' } },
      },
    } as VbrandType;
    const css = emitAndRead(schema);
    expect(css).toContain(':root, [data-theme="light"]');
  });

  it('uses "[data-theme=\\"dark\\"]" selector for dark mode', () => {
    const schema = {
      ...BASE_SCHEMA,
      themes: {
        modes: ['dark'],
        registry: { dark: { primary: '#000000' } },
      },
    } as VbrandType;
    const css = emitAndRead(schema);
    expect(css).toContain('[data-theme="dark"]');
    expect(css).not.toContain(':root, [data-theme="dark"]');
  });

  it('uses "[data-theme=\\"highContrast\\"]" for highContrast mode', () => {
    const schema = {
      ...BASE_SCHEMA,
      themes: {
        modes: ['highContrast'],
        registry: { highContrast: { primary: '#ff0000' } },
      },
    } as VbrandType;
    const css = emitAndRead(schema);
    expect(css).toContain('[data-theme="highContrast"]');
  });

  it('emits --vb- prefixed vars inside theme block', () => {
    const schema = {
      ...BASE_SCHEMA,
      themes: {
        modes: ['dark'],
        registry: { dark: { primary: '#f8fafc' } },
      },
    } as VbrandType;
    const css = emitAndRead(schema);
    expect(css).toContain('--vb-primary: #f8fafc;');
  });

  it('skips empty theme registry entries', () => {
    const schema = {
      ...BASE_SCHEMA,
      themes: {
        modes: ['light', 'dark'],
        registry: { light: {}, dark: { primary: '#000000' } },
      },
    } as VbrandType;
    const css = emitAndRead(schema);
    expect(css).not.toContain(':root, [data-theme="light"]');
    expect(css).toContain('[data-theme="dark"]');
  });

  it('emits multiple mode blocks in ThemeModeValues order', () => {
    const schema = {
      ...BASE_SCHEMA,
      themes: {
        modes: ['light', 'dark'],
        registry: {
          light: { primary: '#ffffff' },
          dark: { primary: '#000000' },
        },
      },
    } as VbrandType;
    const css = emitAndRead(schema);
    const lightPos = css.indexOf('[data-theme="light"]');
    const darkPos = css.indexOf('[data-theme="dark"]');
    expect(lightPos).toBeLessThan(darkPos);
  });
});

const OPTIONAL_AXES = [
  { schemaKey: 'spacing', cssPrefix: 'space',   tokenKey: 'sm',       tokenVal: '0.5rem'           },
  { schemaKey: 'radius',  cssPrefix: 'radius',  tokenKey: 'sm',       tokenVal: '4px'              },
  { schemaKey: 'shadow',  cssPrefix: 'shadow',  tokenKey: 'md',       tokenVal: '0 4px 6px #0002'  },
  { schemaKey: 'motion',  cssPrefix: 'motion',  tokenKey: 'fast',     tokenVal: '150ms ease'       },
  { schemaKey: 'opacity', cssPrefix: 'opacity', tokenKey: 'disabled', tokenVal: '0.4'              },
  { schemaKey: 'zIndex',  cssPrefix: 'z',       tokenKey: 'modal',    tokenVal: '1000'             },
] as const;

describe('emitCssVars - optional axes (spacing, radius, shadow, motion, opacity, zIndex)', () => {
  it.each(OPTIONAL_AXES)(
    'emits --vb-$cssPrefix-* vars for tokens.$schemaKey',
    ({ schemaKey, cssPrefix, tokenKey, tokenVal }) => {
      const schema = {
        ...BASE_SCHEMA,
        tokens: { ...BASE_SCHEMA.tokens, [schemaKey]: { [tokenKey]: tokenVal } },
      } as VbrandType;
      expect(emitAndRead(schema)).toContain(`--vb-${cssPrefix}-${tokenKey}: ${tokenVal};`);
    },
  );

  it.each(OPTIONAL_AXES.map((a) => `--vb-${a.cssPrefix}-`))(
    'does not emit %s prefix when axis is absent from schema',
    (varPrefix) => {
      expect(emitAndRead(BASE_SCHEMA)).not.toContain(varPrefix);
    },
  );

  it('applies key sanitisation (space to hyphen, lowercase) to optional axis token keys', () => {
    const schema = {
      ...BASE_SCHEMA,
      tokens: { ...BASE_SCHEMA.tokens, spacing: { 'MY SIZE': '1rem' } },
    } as VbrandType;
    expect(emitAndRead(schema)).toContain('--vb-space-my-size: 1rem;');
  });

  it('skips an optional axis whose record is present but empty', () => {
    const schema = {
      ...BASE_SCHEMA,
      tokens: { ...BASE_SCHEMA.tokens, spacing: {} },
    } as VbrandType;
    expect(emitAndRead(schema)).not.toContain('--vb-space-');
  });

  it('is deterministic when all 8 axes carry tokens', () => {
    const dir1 = mkdtempSync(join(tmpdir(), 'vbrand-css-'));
    dirs.push(dir1);
    const dir2 = mkdtempSync(join(tmpdir(), 'vbrand-css-'));
    dirs.push(dir2);
    const schema = {
      ...BASE_SCHEMA,
      tokens: {
        ...BASE_SCHEMA.tokens,
        spacing: { sm: '0.5rem', md: '1rem' },
        radius: { sm: '4px' },
        shadow: { md: '0 4px 6px #0002' },
        motion: { fast: '150ms ease' },
        opacity: { dim: '0.6' },
        zIndex: { overlay: '900' },
      },
    } as VbrandType;
    emitCssVars(schema, dir1);
    emitCssVars(schema, dir2);
    expect(readFileSync(join(dir1, 'brand-tokens.css'), 'utf-8')).toBe(
      readFileSync(join(dir2, 'brand-tokens.css'), 'utf-8'),
    );
  });
});
