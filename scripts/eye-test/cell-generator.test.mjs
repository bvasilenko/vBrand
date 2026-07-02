// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { describe, it, expect } from 'vitest';
import { latinSquareSample, allCells } from './cell-generator.mjs';
import { FIXTURES, APP_TYPES, MODES, STACKS, CMS_SUBSTRATES } from './axes.mjs';

const LATIN_SAMPLE = latinSquareSample();
const ALL          = allCells();

const TOTAL_LATIN      = FIXTURES.length * APP_TYPES.length * MODES.length;
const TOTAL_EXHAUSTIVE = FIXTURES.length * APP_TYPES.length * MODES.length * STACKS.length * CMS_SUBSTRATES.length;

function latinKey(c)     { return `${c.fixture}|${c.app}|${c.mode}|${c.cms}`; }
function exhaustiveKey(c){ return `${c.fixture}|${c.app}|${c.mode}|${c.stack}|${c.cms}`; }

describe('latinSquareSample - cell count', () => {
  it('returns exactly FIXTURES * APP_TYPES * MODES cells', () => {
    expect(LATIN_SAMPLE).toHaveLength(TOTAL_LATIN);
  });
});

describe('latinSquareSample - cell shape', () => {
  it.each(['fixture', 'app', 'mode', 'cms', 'index'])('every cell has a %s field', (field) => {
    expect(LATIN_SAMPLE.every((c) => field in c)).toBe(true);
  });

  it('no cell carries a stack field (stack is surfaced via the emit-strip, not per-cell URLs)', () => {
    expect(LATIN_SAMPLE.every((c) => !('stack' in c))).toBe(true);
  });

  it('index is 0-based and increases by exactly 1 per cell', () => {
    LATIN_SAMPLE.forEach((c, i) => expect(c.index).toBe(i));
  });
});

describe('latinSquareSample - axis value membership', () => {
  it.each([
    ['fixture', FIXTURES      ],
    ['app',     APP_TYPES     ],
    ['mode',    MODES         ],
    ['cms',     CMS_SUBSTRATES],
  ])('every cell %s is a member of its axis array', (_axis, allowed) => {
    expect(LATIN_SAMPLE.every((c) => (allowed ).includes(c[_axis]))).toBe(true);
  });
});

describe('latinSquareSample - uniqueness', () => {
  it('all (fixture, app, mode, cms) tuples are unique', () => {
    const keys = LATIN_SAMPLE.map(latinKey);
    expect(new Set(keys).size).toBe(LATIN_SAMPLE.length);
  });
});

describe('latinSquareSample - per-(fixture,app)-pair completeness', () => {
  it('each (fixture, app) pair contributes exactly MODES.length cells', () => {
    const pairCounts = new Map();
    for (const c of LATIN_SAMPLE) {
      const k = `${c.fixture}|${c.app}`;
      pairCounts.set(k, (pairCounts.get(k) ?? 0) + 1);
    }
    for (const [, count] of pairCounts) {
      expect(count).toBe(MODES.length);
    }
  });

  it('each (fixture, app) pair covers every distinct mode exactly once', () => {
    for (const fixture of FIXTURES) {
      for (const app of APP_TYPES) {
        const pairModes = LATIN_SAMPLE
          .filter((c) => c.fixture === fixture && c.app === app)
          .map((c) => c.mode);
        expect(new Set(pairModes).size).toBe(MODES.length);
      }
    }
  });
});

describe('latinSquareSample - cms distribution', () => {
  it('each cms substrate appears the same number of times across all cells (balanced rotation)', () => {
    const counts = CMS_SUBSTRATES.map((cms) => LATIN_SAMPLE.filter((c) => c.cms === cms).length);
    expect(new Set(counts).size).toBe(1);
  });
});

describe('latinSquareSample - purity', () => {
  it('repeated calls return structurally equal arrays', () => {
    expect(latinSquareSample()).toEqual(LATIN_SAMPLE);
  });

  it('repeated calls return distinct array references', () => {
    expect(latinSquareSample()).not.toBe(LATIN_SAMPLE);
  });
});

describe('allCells - cell count', () => {
  it('returns exactly FIXTURES * APP_TYPES * MODES * STACKS * CMS_SUBSTRATES cells', () => {
    expect(ALL).toHaveLength(TOTAL_EXHAUSTIVE);
  });
});

describe('allCells - cell shape', () => {
  it.each(['fixture', 'app', 'mode', 'stack', 'cms', 'index'])('every cell has a %s field', (field) => {
    expect(ALL.every((c) => field in c)).toBe(true);
  });

  it('index is 0-based and increases by exactly 1 per cell', () => {
    ALL.forEach((c, i) => expect(c.index).toBe(i));
  });
});

describe('allCells - full Cartesian coverage', () => {
  it('every (fixture, app, mode, stack, cms) combination appears exactly once', () => {
    const keys = ALL.map(exhaustiveKey);
    expect(new Set(keys).size).toBe(TOTAL_EXHAUSTIVE);
  });

  it.each(FIXTURES)('fixture "%s" appears APP_TYPES * MODES * STACKS * CMS_SUBSTRATES times', (fixture) => {
    expect(ALL.filter((c) => c.fixture === fixture)).toHaveLength(
      APP_TYPES.length * MODES.length * STACKS.length * CMS_SUBSTRATES.length,
    );
  });

  it.each(STACKS)('stack "%s" appears FIXTURES * APP_TYPES * MODES * CMS_SUBSTRATES times', (stack) => {
    expect(ALL.filter((c) => c.stack === stack)).toHaveLength(
      FIXTURES.length * APP_TYPES.length * MODES.length * CMS_SUBSTRATES.length,
    );
  });

  it.each(CMS_SUBSTRATES)('cms "%s" appears FIXTURES * APP_TYPES * MODES * STACKS times', (cms) => {
    expect(ALL.filter((c) => c.cms === cms)).toHaveLength(
      FIXTURES.length * APP_TYPES.length * MODES.length * STACKS.length,
    );
  });
});

describe('allCells - purity', () => {
  it('repeated calls return structurally equal arrays', () => {
    expect(allCells()).toEqual(ALL);
  });

  it('repeated calls return distinct array references', () => {
    expect(allCells()).not.toBe(ALL);
  });
});
