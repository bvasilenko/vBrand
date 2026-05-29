// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { describe, expect, it } from 'vitest';
import {
  wcagContrastRatio,
  apcaLcContrast,
  checkContrast,
  type WcagGrade,
} from '../src/lib/audit/contrast.js';

const DARK_ON_LIGHT = { text: '#000000', bg: '#ffffff' } as const;
const LIGHT_ON_DARK = { text: '#ffffff', bg: '#000000' } as const;
const SAME_COLOR    = { text: '#888888', bg: '#888888' } as const;
const AA_PAIR       = { text: '#757575', bg: '#ffffff' } as const;
const AA_LARGE_PAIR = { text: '#888888', bg: '#ffffff' } as const;
const FAIL_PAIR     = { text: '#c0c0c0', bg: '#ffffff' } as const;
const AAA_PAIR      = { text: '#0f172a', bg: '#f8fafc' } as const;

describe('wcagContrastRatio - algorithm properties', () => {
  it('is symmetric: swapping fg and bg does not change the ratio', () => {
    const fwd = wcagContrastRatio(AA_PAIR.text, AA_PAIR.bg);
    const rev = wcagContrastRatio(AA_PAIR.bg, AA_PAIR.text);
    expect(fwd).toBeCloseTo(rev, 8);
  });

  it('minimum is 1:1 when both colors are identical', () => {
    expect(wcagContrastRatio(SAME_COLOR.text, SAME_COLOR.bg)).toBeCloseTo(1, 5);
  });

  it('maximum for real-world sRGB is 21:1 (black on white)', () => {
    expect(wcagContrastRatio(DARK_ON_LIGHT.text, DARK_ON_LIGHT.bg)).toBeCloseTo(21, 1);
  });

  it('returns a ratio greater than 1 for any two non-identical colors', () => {
    expect(wcagContrastRatio(AA_PAIR.text, AA_PAIR.bg)).toBeGreaterThan(1);
  });

  it('expands 3-digit shorthand hex identically to its 6-digit form', () => {
    expect(wcagContrastRatio('#000', '#fff')).toBeCloseTo(
      wcagContrastRatio('#000000', '#ffffff'),
      5,
    );
  });
});

describe('wcagContrastRatio - grade bracket boundaries', () => {
  it.each<[string, string, number, WcagGrade]>([
    [DARK_ON_LIGHT.text, DARK_ON_LIGHT.bg, 21,   'AAA'     ],
    [AAA_PAIR.text,      AAA_PAIR.bg,      17.06, 'AAA'     ],
    [AA_PAIR.text,       AA_PAIR.bg,        4.61, 'AA'      ],
    [AA_LARGE_PAIR.text, AA_LARGE_PAIR.bg,  3.54, 'AA-large'],
    [FAIL_PAIR.text,     FAIL_PAIR.bg,      1.82, 'fail'    ],
    [SAME_COLOR.text,    SAME_COLOR.bg,     1,    'fail'    ],
  ])('%s on %s: ratio ~%d, grade %s', (text, bg, expectedRatio, expectedGrade) => {
    const result = checkContrast(text, bg);
    expect(result.wcagRatio).toBeCloseTo(expectedRatio, 1);
    expect(result.wcagGrade).toBe(expectedGrade);
  });
});

describe('apcaLcContrast - algorithm properties', () => {
  it('dark text on light background returns a positive Lc value', () => {
    expect(apcaLcContrast(DARK_ON_LIGHT.text, DARK_ON_LIGHT.bg)).toBeGreaterThan(0);
  });

  it('light text on dark background returns a negative Lc value', () => {
    expect(apcaLcContrast(LIGHT_ON_DARK.text, LIGHT_ON_DARK.bg)).toBeLessThan(0);
  });

  it('identical foreground and background return Lc of 0', () => {
    expect(apcaLcContrast(SAME_COLOR.text, SAME_COLOR.bg)).toBeCloseTo(0, 1);
  });

  it('Lc magnitude is consistent: |dark-on-light| and |light-on-dark| are both above 100', () => {
    expect(Math.abs(apcaLcContrast(DARK_ON_LIGHT.text, DARK_ON_LIGHT.bg))).toBeGreaterThan(100);
    expect(Math.abs(apcaLcContrast(LIGHT_ON_DARK.text, LIGHT_ON_DARK.bg))).toBeGreaterThan(100);
  });
});

describe('apcaLcContrast - adequacy threshold', () => {
  it.each<[string, string, boolean]>([
    [DARK_ON_LIGHT.text, DARK_ON_LIGHT.bg, true ],
    [AAA_PAIR.text,      AAA_PAIR.bg,      true ],
    [AA_PAIR.text,       AA_PAIR.bg,       true ],
    [AA_LARGE_PAIR.text, AA_LARGE_PAIR.bg, true ],  // Lc 62.7 (just above 60 threshold)
    [FAIL_PAIR.text,     FAIL_PAIR.bg,     false],
    [SAME_COLOR.text,    SAME_COLOR.bg,    false],
  ])('%s on %s: apcaAdequate=%s', (text, bg, expected) => {
    expect(checkContrast(text, bg).apcaAdequate).toBe(expected);
  });
});

describe('checkContrast - result shape and precision', () => {
  it('returns input hex values verbatim in textHex and bgHex fields', () => {
    const result = checkContrast(AA_PAIR.text, AA_PAIR.bg);
    expect(result.textHex).toBe(AA_PAIR.text);
    expect(result.bgHex).toBe(AA_PAIR.bg);
  });

  it('wcagRatio is rounded to at most 2 decimal places', () => {
    const result = checkContrast(AA_PAIR.text, AA_PAIR.bg);
    expect(result.wcagRatio).toBe(Math.round(result.wcagRatio * 100) / 100);
  });

  it('apcaLc is rounded to at most 1 decimal place', () => {
    const result = checkContrast(AA_PAIR.text, AA_PAIR.bg);
    expect(result.apcaLc).toBe(Math.round(result.apcaLc * 10) / 10);
  });

  it('result contains wcagRatio, wcagGrade, apcaLc, apcaAdequate, textHex, bgHex', () => {
    const result = checkContrast(DARK_ON_LIGHT.text, DARK_ON_LIGHT.bg);
    expect(result).toMatchObject({
      textHex: expect.any(String),
      bgHex: expect.any(String),
      wcagRatio: expect.any(Number),
      wcagGrade: expect.any(String),
      apcaLc: expect.any(Number),
      apcaAdequate: expect.any(Boolean),
    });
  });
});
