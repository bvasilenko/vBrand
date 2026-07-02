// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { describe, it, expect, beforeAll, vi } from 'vitest';

type LatinCell     = { fixture: string; app: string; mode: string; cms: string; index: number };
type ExhaustiveCell = LatinCell & { stack: string };

let FIXTURES: string[];
let APP_TYPES: string[];
let MODES: string[];
let STACKS: string[];
let CMS_SUBSTRATES: string[];
let latinSquareSample: () => LatinCell[];
let allCells: () => ExhaustiveCell[];

beforeAll(async () => {
  const axes = await vi.importActual<{
    FIXTURES: string[]; APP_TYPES: string[]; MODES: string[]; STACKS: string[]; CMS_SUBSTRATES: string[];
  }>('../../../scripts/eye-test/axes.mjs');
  ({ FIXTURES, APP_TYPES, MODES, STACKS, CMS_SUBSTRATES } = axes);

  const gen = await vi.importActual<{ latinSquareSample: () => LatinCell[]; allCells: () => ExhaustiveCell[] }>(
    '../../../scripts/eye-test/cell-generator.mjs',
  );
  ({ latinSquareSample, allCells } = gen);
});

describe('latinSquareSample - axis coverage', () => {
  it('every FIXTURE value appears at least once', () => {
    const covered = new Set(latinSquareSample().map((c) => c.fixture));
    for (const f of FIXTURES) expect(covered.has(f)).toBe(true);
  });

  it('every APP_TYPE value appears at least once', () => {
    const covered = new Set(latinSquareSample().map((c) => c.app));
    for (const a of APP_TYPES) expect(covered.has(a)).toBe(true);
  });

  it('every MODE value appears at least once', () => {
    const covered = new Set(latinSquareSample().map((c) => c.mode));
    for (const m of MODES) expect(covered.has(m)).toBe(true);
  });

  it('every CMS_SUBSTRATE value appears at least once', () => {
    const covered = new Set(latinSquareSample().map((c) => c.cms));
    for (const cms of CMS_SUBSTRATES) expect(covered.has(cms)).toBe(true);
  });
});

describe('latinSquareSample - frequency balance', () => {
  it('each FIXTURE value appears the same number of times', () => {
    const cells = latinSquareSample();
    const freqs = FIXTURES.map((f) => cells.filter((c) => c.fixture === f).length);
    expect(new Set(freqs).size).toBe(1);
  });

  it('each APP_TYPE value appears the same number of times', () => {
    const cells = latinSquareSample();
    const freqs = APP_TYPES.map((a) => cells.filter((c) => c.app === a).length);
    expect(new Set(freqs).size).toBe(1);
  });

  it('each MODE value appears the same number of times', () => {
    const cells = latinSquareSample();
    const freqs = MODES.map((m) => cells.filter((c) => c.mode === m).length);
    expect(new Set(freqs).size).toBe(1);
  });

  it('each CMS_SUBSTRATE value appears the same number of times', () => {
    const cells = latinSquareSample();
    const freqs = CMS_SUBSTRATES.map((cms) => cells.filter((c) => c.cms === cms).length);
    expect(new Set(freqs).size).toBe(1);
  });
});

describe('allCells - frequency coverage (app_type and mode)', () => {
  it('each APP_TYPE value appears FIXTURES * MODES * STACKS * CMS_SUBSTRATES times', () => {
    const cells = allCells();
    for (const app of APP_TYPES) {
      expect(cells.filter((c) => c.app === app)).toHaveLength(
        FIXTURES.length * MODES.length * STACKS.length * CMS_SUBSTRATES.length,
      );
    }
  });

  it('each MODE value appears FIXTURES * APP_TYPES * STACKS * CMS_SUBSTRATES times', () => {
    const cells = allCells();
    for (const mode of MODES) {
      expect(cells.filter((c) => c.mode === mode)).toHaveLength(
        FIXTURES.length * APP_TYPES.length * STACKS.length * CMS_SUBSTRATES.length,
      );
    }
  });
});

describe('latinSquareSample vs allCells - scale contract', () => {
  it('sample is strictly smaller than the exhaustive set', () => {
    expect(latinSquareSample().length).toBeLessThan(allCells().length);
  });

  it('sample size is less than 10% of the exhaustive set', () => {
    expect(latinSquareSample().length).toBeLessThan(allCells().length * 0.1);
  });

  it('sample size equals exhaustive size divided by STACKS * CMS_SUBSTRATES', () => {
    expect(latinSquareSample().length * STACKS.length * CMS_SUBSTRATES.length).toBe(allCells().length);
  });
});

describe('latinSquareSample - per-fixture axis variation', () => {
  it('each fixture has at least 2 distinct CMS substrates across its cells', () => {
    const cells = latinSquareSample();
    for (const fixture of FIXTURES) {
      const distinctCms = new Set(cells.filter((c) => c.fixture === fixture).map((c) => c.cms));
      expect(distinctCms.size).toBeGreaterThanOrEqual(2);
    }
  });
});
