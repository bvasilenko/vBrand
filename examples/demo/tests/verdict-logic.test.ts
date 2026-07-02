// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { describe, it, expect } from 'vitest';
import { axisFromProbeFile, deriveTag, buildVerdict, REQUIRED_AXIS_NAMES, type Tally } from './runtime-probe/verdict-logic.js';

function tally(passed: number, failed: number, skipped: number): Tally {
  return { passed, failed, skipped, total: passed + failed + skipped };
}

function axisTally(passed: number, failed: number, skipped: number, axes: string[]): Tally {
  return { ...tally(passed, failed, skipped), axes };
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

  it('returns CLEAN when axes field is absent even if coverage would be partial', () => {
    expect(deriveTag(tally(5, 0, 0))).toBe('CLEAN');
  });

  it('returns DEFERRED when axes are tracked but not all required axes are covered', () => {
    expect(deriveTag(axisTally(12, 0, 0, ['stack', 'cms']))).toBe('DEFERRED');
  });

  it('returns DEFERRED when axes are tracked but none of the required axes are covered', () => {
    expect(deriveTag(axisTally(4, 0, 0, ['theme']))).toBe('DEFERRED');
  });

  it('BUGS takes precedence over DEFERRED when failures are present alongside missing axes', () => {
    expect(deriveTag(axisTally(5, 2, 0, ['stack']))).toBe('BUGS');
  });

  it('PARTIAL takes precedence over DEFERRED when skips are present alongside missing axes', () => {
    expect(deriveTag(axisTally(5, 0, 1, ['stack']))).toBe('PARTIAL');
  });

  it('returns CLEAN when all required axes are covered with no failures or skips', () => {
    expect(deriveTag(axisTally(30, 0, 0, ['stack', 'cms', 'deploy']))).toBe('CLEAN');
  });

  it('returns CLEAN when custom required axes are all present', () => {
    expect(deriveTag({ ...axisTally(10, 0, 0, ['stack']), requiredAxes: ['stack'] })).toBe('CLEAN');
  });

  it('returns DEFERRED when custom required axes are not all covered', () => {
    expect(deriveTag({ ...axisTally(10, 0, 0, ['stack']), requiredAxes: ['stack', 'cms'] })).toBe('DEFERRED');
  });

  it('returns DEFERRED when axes is an empty array (tracking active but no probe files collected)', () => {
    expect(deriveTag({ ...tally(5, 0, 0), axes: [] })).toBe('DEFERRED');
  });

  it('returns CLEAN when requiredAxes is an empty array (vacuously all required axes are covered)', () => {
    expect(deriveTag({ ...axisTally(5, 0, 0, []), requiredAxes: [] })).toBe('CLEAN');
  });
});

describe('buildVerdict - output format', () => {
  it.each<[string, Tally]>([
    ['CLEAN',            tally(5, 0, 0)                ],
    ['BUGS',             tally(0, 3, 0)                ],
    ['PARTIAL',          tally(2, 0, 1)                ],
    ['DEFERRED',         axisTally(4, 0, 0, ['stack']) ],
    ['UNGROUNDED-CLAIM', tally(0, 0, 0)                ],
  ])('%s verdict: output begins with the tag name followed by a colon-space', (tag, t) => {
    expect(buildVerdict(t)).toMatch(new RegExp(`^${tag}: `));
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

  it('axis coverage count comes from named required probe families', () => {
    const t = axisTally(6, 2, 2, ['stack', 'cms', 'deploy']);
    expect(buildVerdict(t)).toContain('3/3 axes covered');
  });

  it('axis coverage count is 0/3 for an empty tally because the required axis set is stable', () => {
    expect(buildVerdict(tally(0, 0, 0))).toContain('0/3 axes covered');
  });

  it('axis coverage count is independent from probe volume and still exposes missing axes', () => {
    const t = axisTally(3, 2, 0, ['stack', 'cms']);
    expect(buildVerdict(t)).toContain('2/3 axes covered');
  });

  it('axis coverage de-duplicates repeated test files from retries and sharding', () => {
    const t = axisTally(30, 0, 0, ['stack', 'stack', 'cms', 'cms', 'deploy']);
    expect(buildVerdict(t)).toContain('3/3 axes covered');
  });

  it('unknown axis names do not inflate required-axis coverage', () => {
    const t = axisTally(30, 0, 0, ['stack', 'cms', 'theme']);
    expect(buildVerdict(t)).toContain('2/3 axes covered');
  });

  it('custom required-axis sets keep the formatter reusable for narrower probes', () => {
    const verdict = buildVerdict({ ...axisTally(30, 0, 0, ['stack']), requiredAxes: ['stack'] });
    expect(verdict).toContain('1/1 axes covered');
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
    const verdict = buildVerdict(axisTally(12, 0, 0, ['stack', 'cms', 'deploy']));
    expect(verdict).toMatch(/^CLEAN: \d+ probes, 0 bugs, \d+\/\d+ axes covered$/);
  });

  it('CLEAN verdict does not contain BUGS, PARTIAL, DEFERRED, or UNGROUNDED-CLAIM substrings', () => {
    const verdict = buildVerdict(axisTally(5, 0, 0, ['stack', 'cms', 'deploy']));
    expect(verdict).not.toContain('BUGS');
    expect(verdict).not.toContain('PARTIAL');
    expect(verdict).not.toContain('DEFERRED');
    expect(verdict).not.toContain('UNGROUNDED-CLAIM');
  });

  it('DEFERRED verdict is emitted when required axes are missing despite all passing', () => {
    const verdict = buildVerdict(axisTally(12, 0, 0, ['stack', 'cms']));
    expect(verdict).toMatch(/^DEFERRED:/);
    expect(verdict).not.toContain('BUGS');
    expect(verdict).not.toContain('PARTIAL');
    expect(verdict).not.toContain('UNGROUNDED-CLAIM');
  });

  it('DEFERRED verdict reports the actual coverage fraction to aid diagnosis', () => {
    const verdict = buildVerdict(axisTally(12, 0, 0, ['stack', 'cms']));
    expect(verdict).toContain('2/3 axes covered');
  });
});

describe('axisFromProbeFile - generalized runtime-probe classification', () => {
  it.each([
    ['/repo/examples/demo/tests/runtime-probe/stack-axis.test.ts', 'stack'],
    ['C:\\repo\\examples\\demo\\tests\\runtime-probe\\cms-axis.test.ts', 'cms'],
    ['deploy-axis.test.js', 'deploy'],
  ])('%s -> %s', (file, axis) => {
    expect(axisFromProbeFile(file)).toBe(axis);
  });

  it.each([
    '/repo/examples/demo/tests/runtime-probe/theme-apply.test.ts',
    '/repo/examples/demo/tests/runtime-probe/stack-axis.fixture.ts',
    '',
    'Stack-axis.test.ts',
    'stack-axis.test.tsx',
    'stack-axis.spec.ts',
  ])('%s -> null', (file) => {
    expect(axisFromProbeFile(file)).toBeNull();
  });
});

describe('REQUIRED_AXIS_NAMES - gate contract', () => {
  it('contains exactly the three axes required for a CLEAN iteration-3 verdict', () => {
    expect([...REQUIRED_AXIS_NAMES].sort()).toEqual(['cms', 'deploy', 'stack']);
  });

  it('has exactly 3 members (one per shipped iteration-3 probe family)', () => {
    expect(REQUIRED_AXIS_NAMES).toHaveLength(3);
  });

  it('contains stack as a required axis', () => {
    expect(REQUIRED_AXIS_NAMES).toContain('stack');
  });

  it('contains cms as a required axis', () => {
    expect(REQUIRED_AXIS_NAMES).toContain('cms');
  });

  it('contains deploy as a required axis', () => {
    expect(REQUIRED_AXIS_NAMES).toContain('deploy');
  });

  it('has no duplicate entries', () => {
    expect(new Set(REQUIRED_AXIS_NAMES).size).toBe(REQUIRED_AXIS_NAMES.length);
  });
});

describe('axisFromProbeFile - additional path patterns', () => {
  it.each([
    ['relative path without directory prefix', 'stack-axis.test.ts', 'stack'],
    ['path with mixed adjacent name segments', 'tests/runtime-probe/cms-axis.test.ts', 'cms'],
    ['JS extension is accepted alongside TS', 'deploy-axis.test.js', 'deploy'],
    ['deeply nested POSIX path', '/a/b/c/d/e/stack-axis.test.ts', 'stack'],
  ])('%s', (_, file, expected) => {
    expect(axisFromProbeFile(file)).toBe(expected);
  });

  it.each([
    ['axis name with numeric suffix is not matched', 'stack-axis2.test.ts'],
    ['axis name in directory component only is not matched', 'stack-axis/probe.test.ts'],
    ['TSX extension is not matched', 'stack-axis.test.tsx'],
    ['spec suffix is not matched', 'cms-axis.spec.ts'],
    ['fixture extension is not matched', 'stack-axis.fixture.ts'],
    ['uppercase axis prefix is not matched (case-sensitive)', 'Stack-axis.test.ts'],
    ['non-axis suffix before test extension is not matched', 'stack-probe.test.ts'],
  ])('%s -> null', (_, file) => {
    expect(axisFromProbeFile(file)).toBeNull();
  });
});

describe('buildVerdict - axis coverage fraction accuracy', () => {
  it('extra non-required axes in covered set do not inflate the M/M fraction', () => {
    const t: Tally = { passed: 10, failed: 0, skipped: 0, total: 10, axes: ['stack', 'cms', 'deploy', 'theme', 'layout'] };
    const verdict = buildVerdict(t);
    expect(verdict).toContain('3/3 axes covered');
  });

  it('reports 1/3 when only one required axis is covered', () => {
    const t: Tally = { passed: 5, failed: 0, skipped: 0, total: 5, axes: ['stack'] };
    expect(buildVerdict(t)).toContain('1/3 axes covered');
  });

  it('reports 2/3 when exactly two required axes are covered', () => {
    const t: Tally = { passed: 8, failed: 0, skipped: 0, total: 8, axes: ['stack', 'deploy'] };
    expect(buildVerdict(t)).toContain('2/3 axes covered');
  });

  it('custom requiredAxes override the default 3-axis set in the coverage fraction', () => {
    const t: Tally = { passed: 4, failed: 0, skipped: 0, total: 4, axes: ['stack'], requiredAxes: ['stack'] };
    expect(buildVerdict(t)).toContain('1/1 axes covered');
  });

  it('reports 0/3 axes covered when no axes are tracked regardless of probe volume', () => {
    const t: Tally = { passed: 100, failed: 0, skipped: 0, total: 100, axes: [] };
    expect(buildVerdict(t)).toContain('0/3 axes covered');
  });
});
