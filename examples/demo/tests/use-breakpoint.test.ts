// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useBreakpoint, deriveBreakpoint, WIDE_MIN_PX, MID_MIN_PX } from '../src/use-breakpoint.js';
import type { Breakpoint } from '../src/use-breakpoint.js';

const ALL_BREAKPOINTS: readonly Breakpoint[] = ['wide', 'mid', 'narrow'];

// wide=true always implies mid=true in real viewports.
type MediaState = { readonly wide: boolean; readonly mid: boolean };
const MEDIA_STATE: Record<Breakpoint, MediaState> = {
  wide:   { wide: true,  mid: true  },
  mid:    { wide: false, mid: true  },
  narrow: { wide: false, mid: false },
};

const TRANSITIONS: ReadonlyArray<[from: Breakpoint, to: Breakpoint]> = [
  ['wide',   'mid'   ],
  ['wide',   'narrow'],
  ['mid',    'wide'  ],
  ['mid',    'narrow'],
  ['narrow', 'wide'  ],
  ['narrow', 'mid'   ],
];

// narrow uses MID_MIN_PX - 1 (one pixel below the mid threshold).
const INNER_WIDTH_FOR: Record<Breakpoint, number> = {
  wide:   WIDE_MIN_PX,
  mid:    MID_MIN_PX,
  narrow: MID_MIN_PX - 1,
};

describe('test harness - INNER_WIDTH_FOR produces the declared breakpoint', () => {
  it.each(ALL_BREAKPOINTS)(
    'deriveBreakpoint(INNER_WIDTH_FOR[%s]) === %s',
    (bp) => {
      expect(deriveBreakpoint(INNER_WIDTH_FOR[bp])).toBe(bp);
    },
  );
});

describe('test harness - MEDIA_STATE satisfies the real-viewport implication', () => {
  it.each(ALL_BREAKPOINTS)(
    'MEDIA_STATE[%s]: wide=true always implies mid=true',
    (bp) => {
      if (MEDIA_STATE[bp].wide) {
        expect(MEDIA_STATE[bp].mid).toBe(true);
      }
    },
  );

  it('MEDIA_STATE covers all declared breakpoints with no extras', () => {
    expect(Object.keys(MEDIA_STATE).sort()).toEqual([...ALL_BREAKPOINTS].sort());
  });
});

describe('test harness - TRANSITIONS covers every directed pair of distinct breakpoints', () => {
  it('contains exactly n*(n-1) entries for n breakpoints (no missing, no duplicate directions)', () => {
    const expectedCount = ALL_BREAKPOINTS.length * (ALL_BREAKPOINTS.length - 1);
    expect(TRANSITIONS).toHaveLength(expectedCount);
  });

  it('every entry is an ordered pair [from, to] of distinct known breakpoints', () => {
    for (const [from, to] of TRANSITIONS) {
      expect(ALL_BREAKPOINTS).toContain(from);
      expect(ALL_BREAKPOINTS).toContain(to);
      expect(from).not.toBe(to);
    }
  });

  it('no directed pair appears more than once', () => {
    const keys = TRANSITIONS.map(([from, to]) => `${from}->${to}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

type ChangeHandler = (e: { matches: boolean }) => void;

function makeMatchMediaMock(initial: MediaState) {
  const state = { ...initial };
  const handlers: Map<string, ChangeHandler[]> = new Map();

  function mockMQ(query: string) {
    const isWide = query.includes(`${WIDE_MIN_PX}px`);
    return {
      get matches() { return isWide ? state.wide : state.mid; },
      addEventListener(_: string, h: ChangeHandler) {
        handlers.set(query, [...(handlers.get(query) ?? []), h]);
      },
      removeEventListener(_: string, h: ChangeHandler) {
        handlers.set(query, (handlers.get(query) ?? []).filter((fn) => fn !== h));
      },
    };
  }

  function trigger(next: MediaState) {
    state.wide = next.wide;
    state.mid  = next.mid;
    for (const [query, list] of handlers.entries()) {
      const isWide = query.includes(`${WIDE_MIN_PX}px`);
      for (const h of list) h({ matches: isWide ? next.wide : next.mid });
    }
  }

  function listenerCount(): number {
    return [...handlers.values()].reduce((n, list) => n + list.length, 0);
  }

  return { mockMQ, trigger, listenerCount };
}

function Probe(): React.ReactElement {
  return React.createElement('span', { 'data-bp': useBreakpoint() });
}

function readBp(container: HTMLElement): string {
  return container.querySelector('[data-bp]')?.getAttribute('data-bp') ?? '';
}

let container: HTMLDivElement;
let root: Root;
let mounted = false;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  mounted = true;
});

afterEach(() => {
  if (mounted) {
    act(() => { root.unmount(); });
    mounted = false;
  }
  container.remove();
  vi.restoreAllMocks();
});

describe('deriveBreakpoint - boundary contract', () => {
  const CASES: ReadonlyArray<[width: number, expected: Breakpoint]> = [
    [WIDE_MIN_PX,      'wide'  ],
    [WIDE_MIN_PX + 1,  'wide'  ],
    [WIDE_MIN_PX + 400,'wide'  ],
    [WIDE_MIN_PX - 1,  'mid'   ],
    [MID_MIN_PX,       'mid'   ],
    [MID_MIN_PX + 1,   'mid'   ],
    [MID_MIN_PX - 1,   'narrow'],
    [1,                'narrow'],
    [0,                'narrow'],
  ];

  it.each(CASES)('width %i → %s', (width, expected) => {
    expect(deriveBreakpoint(width)).toBe(expected);
  });
});

describe('deriveBreakpoint - ordering invariant', () => {
  it('wider width never produces a narrower breakpoint', () => {
    const ORDER: Record<Breakpoint, number> = { narrow: 0, mid: 1, wide: 2 };
    const widths = [0, MID_MIN_PX - 1, MID_MIN_PX, WIDE_MIN_PX - 1, WIDE_MIN_PX, WIDE_MIN_PX + 1000];
    for (let i = 0; i < widths.length - 1; i++) {
      expect(ORDER[deriveBreakpoint(widths[i + 1])]).toBeGreaterThanOrEqual(ORDER[deriveBreakpoint(widths[i])]);
    }
  });

  it('returns one of the known breakpoint names for any non-negative integer width', () => {
    const samples = [0, 1, 320, 640, 768, 900, 1024, 1100, 1440, 1920, 9999];
    for (const w of samples) {
      expect(ALL_BREAKPOINTS).toContain(deriveBreakpoint(w));
    }
  });
});

describe('useBreakpoint - initial breakpoint from window.innerWidth', () => {
  const INITIAL_CASES: ReadonlyArray<[width: number, expected: Breakpoint]> = [
    [WIDE_MIN_PX,     'wide'  ],
    [WIDE_MIN_PX - 1, 'mid'   ],
    [MID_MIN_PX - 1,  'narrow'],
  ];

  it.each(INITIAL_CASES)('innerWidth=%i → initial breakpoint is %s', (width, expected) => {
    Object.defineProperty(window, 'innerWidth', { value: width, configurable: true });
    const { mockMQ } = makeMatchMediaMock(MEDIA_STATE[expected]);
    vi.spyOn(window, 'matchMedia').mockImplementation(mockMQ as unknown as typeof window.matchMedia);

    act(() => { root.render(React.createElement(Probe)); });
    expect(readBp(container)).toBe(expected);
  });
});

describe('useBreakpoint - breakpoint transitions via matchMedia changes', () => {
  it.each(TRANSITIONS)('%s → %s transition updates the returned breakpoint', (from, to) => {
    Object.defineProperty(window, 'innerWidth', { value: INNER_WIDTH_FOR[from], configurable: true });
    const { mockMQ, trigger } = makeMatchMediaMock(MEDIA_STATE[from]);
    vi.spyOn(window, 'matchMedia').mockImplementation(mockMQ as unknown as typeof window.matchMedia);

    act(() => { root.render(React.createElement(Probe)); });
    expect(readBp(container)).toBe(from);

    act(() => { trigger(MEDIA_STATE[to]); });
    expect(readBp(container)).toBe(to);
  });

  it('multiple sequential transitions each update the breakpoint correctly', () => {
    Object.defineProperty(window, 'innerWidth', { value: WIDE_MIN_PX, configurable: true });
    const { mockMQ, trigger } = makeMatchMediaMock(MEDIA_STATE['wide']);
    vi.spyOn(window, 'matchMedia').mockImplementation(mockMQ as unknown as typeof window.matchMedia);

    act(() => { root.render(React.createElement(Probe)); });

    for (const [, to] of TRANSITIONS) {
      act(() => { trigger(MEDIA_STATE[to]); });
      expect(readBp(container)).toBe(to);
    }
  });

  it('triggering the same breakpoint twice in succession keeps the observed breakpoint stable', () => {
    Object.defineProperty(window, 'innerWidth', { value: INNER_WIDTH_FOR['wide'], configurable: true });
    const { mockMQ, trigger } = makeMatchMediaMock(MEDIA_STATE['wide']);
    vi.spyOn(window, 'matchMedia').mockImplementation(mockMQ as unknown as typeof window.matchMedia);

    act(() => { root.render(React.createElement(Probe)); });
    act(() => { trigger(MEDIA_STATE['mid']); });
    expect(readBp(container)).toBe('mid');

    act(() => { trigger(MEDIA_STATE['mid']); });
    expect(readBp(container)).toBe('mid');
  });

  it('two rapid triggers within a single act settle on the final breakpoint', () => {
    Object.defineProperty(window, 'innerWidth', { value: INNER_WIDTH_FOR['wide'], configurable: true });
    const { mockMQ, trigger } = makeMatchMediaMock(MEDIA_STATE['wide']);
    vi.spyOn(window, 'matchMedia').mockImplementation(mockMQ as unknown as typeof window.matchMedia);

    act(() => { root.render(React.createElement(Probe)); });

    act(() => {
      trigger(MEDIA_STATE['narrow']);
      trigger(MEDIA_STATE['mid']);
    });

    expect(readBp(container)).toBe('mid');
  });
});

describe('useBreakpoint - event listener cleanup on unmount', () => {
  it('matchMedia changes after unmount do not update the observed breakpoint', () => {
    Object.defineProperty(window, 'innerWidth', { value: WIDE_MIN_PX, configurable: true });
    const { mockMQ, trigger } = makeMatchMediaMock(MEDIA_STATE['wide']);
    vi.spyOn(window, 'matchMedia').mockImplementation(mockMQ as unknown as typeof window.matchMedia);

    act(() => { root.render(React.createElement(Probe)); });
    expect(readBp(container)).toBe('wide');

    act(() => { root.unmount(); });
    mounted = false;

    act(() => { trigger(MEDIA_STATE['narrow']); });
    expect(readBp(container)).not.toBe('narrow');
  });

  it('all matchMedia event listeners are removed on unmount', () => {
    Object.defineProperty(window, 'innerWidth', { value: WIDE_MIN_PX, configurable: true });
    const { mockMQ, listenerCount } = makeMatchMediaMock(MEDIA_STATE['wide']);
    vi.spyOn(window, 'matchMedia').mockImplementation(mockMQ as unknown as typeof window.matchMedia);

    act(() => { root.render(React.createElement(Probe)); });
    expect(listenerCount()).toBe(2);

    act(() => { root.unmount(); });
    mounted = false;

    expect(listenerCount()).toBe(0);
  });
});
