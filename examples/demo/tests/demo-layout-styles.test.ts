// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { describe, it, expect } from 'vitest';
import type { CSSProperties } from 'react';
import { deriveLayout } from '../src/demo-layout-styles.js';
import type { Breakpoint } from '../src/use-breakpoint.js';

const ALL_BREAKPOINTS: readonly Breakpoint[] = ['wide', 'mid', 'narrow'];
const GRID_BREAKPOINTS: readonly Breakpoint[] = ['wide', 'mid'];
const GRID_AREA_NAMES = ['composition', 'preview', 'operations'] as const;

function css(props: CSSProperties): Record<string, unknown> {
  return props as Record<string, unknown>;
}

describe('deriveLayout - structural completeness', () => {
  it.each(ALL_BREAKPOINTS)('%s layout has all four required area slots', (bp) => {
    const layout = deriveLayout(bp);
    expect(layout).toHaveProperty('outer');
    expect(layout).toHaveProperty('composition');
    expect(layout).toHaveProperty('preview');
    expect(layout).toHaveProperty('operations');
  });

  it.each(ALL_BREAKPOINTS)('%s outer style specifies a display mode', (bp) => {
    expect(deriveLayout(bp).outer.display).toBeDefined();
  });

  it.each(ALL_BREAKPOINTS)('%s outer style specifies a gap', (bp) => {
    expect(deriveLayout(bp).outer.gap).toBeDefined();
  });

  it.each(ALL_BREAKPOINTS)('%s outer style specifies a padding', (bp) => {
    expect(deriveLayout(bp).outer.padding).toBeDefined();
  });

  it.each(ALL_BREAKPOINTS)('%s outer style specifies fontFamily', (bp) => {
    expect(deriveLayout(bp).outer.fontFamily).toBeDefined();
  });

  it('all breakpoints share the same gap value', () => {
    const gaps = ALL_BREAKPOINTS.map((bp) => deriveLayout(bp).outer.gap);
    expect(new Set(gaps).size).toBe(1);
  });

  it('all breakpoints share the same padding value', () => {
    const paddings = ALL_BREAKPOINTS.map((bp) => deriveLayout(bp).outer.padding);
    expect(new Set(paddings).size).toBe(1);
  });

  it('all breakpoints share the same fontFamily value', () => {
    const fonts = ALL_BREAKPOINTS.map((bp) => deriveLayout(bp).outer.fontFamily);
    expect(new Set(fonts).size).toBe(1);
  });
});

describe('deriveLayout - display mode per breakpoint', () => {
  it.each(GRID_BREAKPOINTS)('%s layout uses CSS grid for multi-column support', (bp) => {
    expect(deriveLayout(bp).outer.display).toBe('grid');
  });

  it('narrow layout uses flexbox for single-column vertical stacking', () => {
    expect(deriveLayout('narrow').outer.display).toBe('flex');
    expect(deriveLayout('narrow').outer.flexDirection).toBe('column');
  });

  it('all three breakpoints produce distinct outer display modes or column arrangements', () => {
    const signatures = ALL_BREAKPOINTS.map((bp) => {
      const { display, flexDirection, gridTemplateColumns } = deriveLayout(bp).outer;
      return JSON.stringify({ display, flexDirection, gridTemplateColumns });
    });
    expect(new Set(signatures).size).toBe(ALL_BREAKPOINTS.length);
  });
});

describe('deriveLayout - CSS grid area assignment (wide, mid)', () => {
  it.each(GRID_BREAKPOINTS)('%s outer gridTemplateAreas names all three zones', (bp) => {
    const areas = deriveLayout(bp).outer.gridTemplateAreas ?? '';
    for (const name of GRID_AREA_NAMES) {
      expect(areas).toContain(name);
    }
  });

  it.each(GRID_BREAKPOINTS)('%s composition zone has gridArea: composition', (bp) => {
    expect(css(deriveLayout(bp).composition).gridArea).toBe('composition');
  });

  it.each(GRID_BREAKPOINTS)('%s preview zone has gridArea: preview', (bp) => {
    expect(css(deriveLayout(bp).preview).gridArea).toBe('preview');
  });

  it.each(GRID_BREAKPOINTS)('%s operations zone has gridArea: operations', (bp) => {
    expect(css(deriveLayout(bp).operations).gridArea).toBe('operations');
  });

  it('narrow layout zones do not assign gridArea (flex children need none)', () => {
    const { composition, preview, operations } = deriveLayout('narrow');
    expect(css(composition).gridArea).toBeUndefined();
    expect(css(preview).gridArea).toBeUndefined();
    expect(css(operations).gridArea).toBeUndefined();
  });

  it('mid layout preview area spans both grid columns', () => {
    const areas = deriveLayout('mid').outer.gridTemplateAreas ?? '';
    expect(areas).toMatch(/preview.*preview/);
  });
});

describe('deriveLayout - preview area display contract', () => {
  it.each(ALL_BREAKPOINTS)('%s preview area always uses display:flex for iframe containment', (bp) => {
    expect(css(deriveLayout(bp).preview).display).toBe('flex');
  });

  it('narrow preview area has an explicit CSS height for iframe containment on small viewports', () => {
    const height = css(deriveLayout('narrow').preview).height;
    expect(height).toBeDefined();
    expect(typeof height).toBe('string');
    expect(String(height).length).toBeGreaterThan(0);
  });

  it('wide preview area does not impose a fixed height (fills available grid track)', () => {
    expect(css(deriveLayout('wide').preview).height).toBeUndefined();
  });

  it('mid preview area does not impose a fixed height (fills available grid track)', () => {
    expect(css(deriveLayout('mid').preview).height).toBeUndefined();
  });

  it('narrow preview area prevents flex-shrink so iframe is not collapsed by sibling panels', () => {
    expect(css(deriveLayout('narrow').preview).flexShrink).toBe(0);
  });
});

describe('deriveLayout - parent-fill contract for wide and mid', () => {
  it.each(GRID_BREAKPOINTS)('%s outer fills the flex parent via flex:1', (bp) => {
    expect(deriveLayout(bp).outer.flex).toBe(1);
  });

  it.each(GRID_BREAKPOINTS)('%s outer sets minHeight:0 to allow grid children to shrink below content size', (bp) => {
    expect(deriveLayout(bp).outer.minHeight).toBe(0);
  });

  it.each(GRID_BREAKPOINTS)('%s operations area allows internal overflow scroll for dense content', (bp) => {
    expect(css(deriveLayout(bp).operations).overflow).toBe('auto');
  });

  it('narrow outer allows vertical scroll for content that exceeds viewport height', () => {
    expect(deriveLayout('narrow').outer.overflowY).toBe('auto');
  });
});

describe('deriveLayout - purity and isolation', () => {
  it.each(ALL_BREAKPOINTS)('%s layout is identical across repeated calls (pure function)', (bp) => {
    expect(deriveLayout(bp)).toEqual(deriveLayout(bp));
  });

  it('all three breakpoints produce distinct outer style objects', () => {
    const styles = ALL_BREAKPOINTS.map((bp) => JSON.stringify(deriveLayout(bp).outer));
    expect(new Set(styles).size).toBe(ALL_BREAKPOINTS.length);
  });

  it('distinct breakpoints do not share object references between layout areas', () => {
    for (const area of ['outer', 'composition', 'preview', 'operations'] as const) {
      const refs = ALL_BREAKPOINTS.map((bp) => deriveLayout(bp)[area]);
      const unique = new Set(refs);
      expect(unique.size).toBe(ALL_BREAKPOINTS.length);
    }
  });
});

describe('deriveLayout - controls-visibility contract', () => {
  it.each(ALL_BREAKPOINTS)('%s outer does not clip overflow on the cross axis (no overflow:hidden)', (bp) => {
    const outer = deriveLayout(bp).outer as Record<string, unknown>;
    expect(outer['overflow']).not.toBe('hidden');
    expect(outer['overflowX']).not.toBe('hidden');
  });

  it.each(ALL_BREAKPOINTS)('%s composition area does not clip overflow (no overflow:hidden)', (bp) => {
    const composition = css(deriveLayout(bp).composition);
    expect(composition['overflow']).not.toBe('hidden');
    expect(composition['overflowX']).not.toBe('hidden');
  });

  it.each(ALL_BREAKPOINTS)('%s operations area does not clip overflow (overflow:auto is permitted; overflow:hidden is not)', (bp) => {
    const ops = css(deriveLayout(bp).operations);
    expect(ops['overflow']).not.toBe('hidden');
    expect(ops['overflowX']).not.toBe('hidden');
  });

  it.each(ALL_BREAKPOINTS)('%s no area uses visibility:hidden', (bp) => {
    const layout = deriveLayout(bp);
    for (const area of ['outer', 'composition', 'preview', 'operations'] as const) {
      expect((layout[area] as Record<string, unknown>)['visibility']).not.toBe('hidden');
    }
  });
});

describe('deriveLayout - horizontal overflow prevention', () => {
  it.each(ALL_BREAKPOINTS)('%s composition area has minWidth:0 so flex/grid children cannot force horizontal overflow', (bp) => {
    expect(css(deriveLayout(bp).composition)['minWidth']).toBe(0);
  });

  it.each(ALL_BREAKPOINTS)('%s preview area has minWidth:0', (bp) => {
    expect(css(deriveLayout(bp).preview)['minWidth']).toBe(0);
  });

  it.each(['mid', 'narrow'] as const)('%s operations area has minWidth:0', (bp) => {
    expect(css(deriveLayout(bp).operations)['minWidth']).toBe(0);
  });

  it('narrow outer does not set a positive minWidth that could force horizontal scroll', () => {
    const outer = deriveLayout('narrow').outer as Record<string, unknown>;
    const minW = outer['minWidth'];
    if (minW !== undefined) {
      expect(minW === 0 || minW === '0' || minW === '0px').toBe(true);
    }
  });
});
