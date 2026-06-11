// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { describe, it, expect } from 'vitest';
import { deriveTag, buildVerdict, type Tally } from './runtime-probe/verdict-logic.js';

function tally(passed: number, failed: number, skipped: number): Tally {
  return { passed, failed, skipped, total: passed + failed + skipped };
}

describe('deriveTag - tag assignment rules', () => {
  it('returns UNGROUNDED-CLAIM when total is zero', () => {
    expect(deriveTag(tally(0, 0, 0))).toBe('UNGROUNDED-CLAIM');
  });

  it('returns BUGS when any test failed, even if others passed', () => {
    expect(deriveTag(tally(9, 1, 0))).toBe('BUGS');
  });

  it('returns BUGS when all tests failed', () => {
    expect(deriveTag(tally(0, 5, 0))).toBe('BUGS');
  });

  it('BUGS takes precedence over PARTIAL when both failed and skipped are present', () => {
    expect(deriveTag(tally(3, 2, 1))).toBe('BUGS');
  });

  it('returns PARTIAL when no failures and at least one skip', () => {
    expect(deriveTag(tally(4, 0, 1))).toBe('PARTIAL');
  });

  it('returns PARTIAL when all tests were skipped and none failed', () => {
    expect(deriveTag(tally(0, 0, 3))).toBe('PARTIAL');
  });

  it('returns CLEAN when all tests passed and none failed or skipped', () => {
    expect(deriveTag(tally(10, 0, 0))).toBe('CLEAN');
  });

  it('returns CLEAN for a single passing test with no failures or skips', () => {
    expect(deriveTag(tally(1, 0, 0))).toBe('CLEAN');
  });
});

describe('buildVerdict - output format', () => {
  it('starts with the correct tag derived from the tally', () => {
    expect(buildVerdict(tally(5, 0, 0))).toMatch(/^CLEAN:/);
    expect(buildVerdict(tally(0, 3, 0))).toMatch(/^BUGS:/);
    expect(buildVerdict(tally(2, 0, 1))).toMatch(/^PARTIAL:/);
    expect(buildVerdict(tally(0, 0, 0))).toMatch(/^UNGROUNDED-CLAIM:/);
  });

  it('contains the total probe count', () => {
    expect(buildVerdict(tally(7, 2, 1))).toContain('10 probes');
  });

  it('uses singular "bug" when exactly one test failed', () => {
    expect(buildVerdict(tally(4, 1, 0))).toContain('1 bug,');
    expect(buildVerdict(tally(4, 1, 0))).not.toContain('1 bugs');
  });

  it('uses plural "bugs" when more than one test failed', () => {
    expect(buildVerdict(tally(3, 2, 0))).toContain('2 bugs');
  });

  it('uses plural "bugs" when zero tests failed', () => {
    expect(buildVerdict(tally(5, 0, 0))).toContain('0 bugs');
  });

  it('surfaces covered count is passed + failed (skipped not counted as covered)', () => {
    const t = tally(6, 2, 2);
    expect(buildVerdict(t)).toContain('8/10 surfaces covered');
  });

  it('surfaces covered count is 0/0 for an empty tally', () => {
    expect(buildVerdict(tally(0, 0, 0))).toContain('0/0 surfaces covered');
  });

  it('surfaces covered count equals total when no tests were skipped', () => {
    const t = tally(3, 2, 0);
    expect(buildVerdict(t)).toContain('5/5 surfaces covered');
  });

  it('output is a single line with no embedded newlines', () => {
    expect(buildVerdict(tally(5, 0, 0))).not.toContain('\n');
  });

  it('parts are comma-separated', () => {
    const verdict = buildVerdict(tally(3, 1, 0));
    const afterColon = verdict.split(': ')[1]!;
    expect(afterColon.split(', ')).toHaveLength(3);
  });
});

describe('buildVerdict - CLEAN gate shape', () => {
  it('a fully green tally emits the exact CLEAN pattern the pipeline greps for', () => {
    const verdict = buildVerdict(tally(12, 0, 0));
    expect(verdict).toMatch(/^CLEAN: \d+ probes, 0 bugs, \d+\/\d+ surfaces covered$/);
  });

  it('a tally with failures emits a BUGS: prefix that pipeline treats as merge-block', () => {
    expect(buildVerdict(tally(8, 3, 0))).toMatch(/^BUGS:/);
  });

  it('CLEAN verdict does not contain BUGS, PARTIAL, or UNGROUNDED-CLAIM substrings', () => {
    const verdict = buildVerdict(tally(5, 0, 0));
    expect(verdict).not.toContain('BUGS');
    expect(verdict).not.toContain('PARTIAL');
    expect(verdict).not.toContain('UNGROUNDED-CLAIM');
  });
});
