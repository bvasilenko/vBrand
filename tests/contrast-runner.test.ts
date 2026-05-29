// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { describe, expect, it } from 'vitest';
import { runContrastCheck } from '../src/lib/audit/contrast-runner.js';
import type { VbrandType } from '../src/schema.js';

const BASE: VbrandType = {
  name: 'contrast-test',
  voice: { canonical: 'Test.', repoDescription: 'Contrast test.' },
  assets: {
    favicon: { source: 'logo.png', sizes: [32] },
    og: { dimensions: [1200, 630] },
    icons: { source: 'icons/', set: [] },
  },
  tokens: { color: {}, type: {} },
};

describe('runContrastCheck - no token pairs', () => {
  it('returns empty array when no tokens present', () => {
    expect(runContrastCheck(BASE)).toHaveLength(0);
  });

  it('returns empty array when color tokens lack text/bg heuristic names', () => {
    const schema: VbrandType = {
      ...BASE,
      tokens: { ...BASE.tokens, color: { primary: '#0f172a', accent: '#3b82f6' } },
    };
    expect(runContrastCheck(schema)).toHaveLength(0);
  });
});

describe('runContrastCheck - flat color token pairs', () => {
  const schema: VbrandType = {
    ...BASE,
    tokens: {
      ...BASE.tokens,
      color: {
        'text-primary': '#0f172a',
        'bg-primary': '#f8fafc',
      },
    },
  };

  it('returns one finding for a single text-bg pair', () => {
    const findings = runContrastCheck(schema);
    expect(findings).toHaveLength(1);
  });

  it('finding includes both token names', () => {
    const [f] = runContrastCheck(schema);
    expect(f!.textToken).toBe('text-primary');
    expect(f!.bgToken).toBe('bg-primary');
  });

  it('finding includes hex values', () => {
    const [f] = runContrastCheck(schema);
    expect(f!.textHex).toBe('#0f172a');
    expect(f!.bgHex).toBe('#f8fafc');
  });

  it('finding passes for high-contrast dark-on-light pair', () => {
    const [f] = runContrastCheck(schema);
    expect(f!.wcagGrade).not.toBe('fail');
    expect(f!.apcaAdequate).toBe(true);
    expect(f!.pass).toBe(true);
  });

  it('finding has no mode when using flat tokens (not themes registry)', () => {
    const [f] = runContrastCheck(schema);
    expect(f!.mode).toBeUndefined();
  });
});

describe('runContrastCheck - failing contrast pair', () => {
  const schema: VbrandType = {
    ...BASE,
    tokens: {
      ...BASE.tokens,
      color: {
        'fg-muted': '#c0c0c0',
        'bg-surface': '#ffffff',
      },
    },
  };

  it('returns a finding with pass:false for low-contrast pair', () => {
    const findings = runContrastCheck(schema);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.wcagGrade).toBe('fail');
    expect(findings[0]!.pass).toBe(false);
  });
});

describe('runContrastCheck - themes registry (preferred over flat tokens)', () => {
  const schema: VbrandType = {
    ...BASE,
    tokens: {
      ...BASE.tokens,
      color: {
        'text-main': '#000000',
        'bg-main': '#ffffff',
      },
    },
    themes: {
      modes: ['light', 'dark'],
      registry: {
        light: { 'text-primary': '#0f172a', 'bg-primary': '#f8fafc' },
        dark: { 'text-primary': '#f1f5f9', 'bg-primary': '#0f172a' },
      },
    },
  };

  it('uses themes.registry instead of flat tokens.color', () => {
    const findings = runContrastCheck(schema);
    // 1 pair per mode = 2 total
    expect(findings).toHaveLength(2);
  });

  it('attaches mode to each finding', () => {
    const findings = runContrastCheck(schema);
    const modes = findings.map((f) => f.mode);
    expect(modes).toContain('light');
    expect(modes).toContain('dark');
  });

  it('all findings pass for high-contrast theme pairs', () => {
    const findings = runContrastCheck(schema);
    expect(findings.every((f) => f.pass)).toBe(true);
  });
});

describe('runContrastCheck - multiple pairs per mode', () => {
  const schema: VbrandType = {
    ...BASE,
    themes: {
      modes: ['light'],
      registry: {
        light: {
          'text-primary': '#0f172a',
          'label-secondary': '#334155',
          'bg-base': '#ffffff',
          'surface-card': '#f8fafc',
        },
      },
    },
  };

  it('generates all text-bg cross products', () => {
    // 2 text tokens × 2 bg tokens = 4 pairs
    const findings = runContrastCheck(schema);
    expect(findings).toHaveLength(4);
  });
});

describe('runContrastCheck - non-hex values are skipped', () => {
  it('ignores tokens whose value is not a hex color', () => {
    const schema: VbrandType = {
      ...BASE,
      tokens: {
        ...BASE.tokens,
        color: {
          'text-brand': 'var(--color-brand)',
          'bg-page': '#ffffff',
        },
      },
    };
    const findings = runContrastCheck(schema);
    expect(findings).toHaveLength(0);
  });
});
