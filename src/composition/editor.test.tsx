// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { CompositionEditor } from './editor.js';
import { DensitySchema } from './spec.js';
import type { CompositionSpec, Density, SectionSpec } from './spec.js';

const ALL_DENSITIES = DensitySchema.options;

function section(
  id: string,
  order: number,
  visible = true,
  density: Density = 'regular',
): SectionSpec {
  return { id, order, visible, density };
}

const ONE_SECTION: CompositionSpec = {
  sections: [section('s0', 0)],
};

const THREE_SECTIONS: CompositionSpec = {
  sections: [section('s0', 0), section('s1', 1), section('s2', 2)],
};

let container: HTMLDivElement;
let root: Root;

function row(id: string): HTMLElement {
  return container.querySelector(`[data-section-id="${id}"]`) as HTMLElement;
}

function moveUp(id: string): HTMLButtonElement {
  return container.querySelector(`[aria-label="Move ${id} up"]`) as HTMLButtonElement;
}

function moveDown(id: string): HTMLButtonElement {
  return container.querySelector(`[aria-label="Move ${id} down"]`) as HTMLButtonElement;
}

function chip(sectionId: string, d: Density): HTMLButtonElement {
  return container.querySelector(
    `[data-section-id="${sectionId}"] [data-density="${d}"]`,
  ) as HTMLButtonElement;
}

function checkbox(id: string): HTMLInputElement {
  return container.querySelector(`#section-${id}`) as HTMLInputElement;
}

function keydown(el: HTMLElement, key: string): void {
  act(() => el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })));
}

function sortedIds(spec: CompositionSpec): string[] {
  return spec.sections.slice().sort((a, b) => a.order - b.order).map((s) => s.id);
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function renderEditor(
  spec: CompositionSpec,
  onChange: (s: CompositionSpec) => void,
): void {
  act(() => {
    root.render(
      React.createElement(CompositionEditor, { spec, onChange, onReset: () => undefined }),
    );
  });
}

describe('CompositionEditor: rendered structure', () => {
  it('renders exactly one row per section in the spec', () => {
    renderEditor(THREE_SECTIONS, vi.fn());
    expect(container.querySelectorAll('[data-section-id]')).toHaveLength(3);
  });

  it('section list container has role="listbox" and a non-empty aria-label', () => {
    renderEditor(ONE_SECTION, vi.fn());
    const ul = container.querySelector('ul[role="listbox"]');
    expect(ul).not.toBeNull();
    expect((ul as HTMLElement).getAttribute('aria-label')).toBeTruthy();
  });

  it('every section row has role="option" (WAI-ARIA listbox pattern)', () => {
    renderEditor(THREE_SECTIONS, vi.fn());
    for (const { id } of THREE_SECTIONS.sections) {
      expect(row(id).getAttribute('role')).toBe('option');
    }
  });

  it('every section row is keyboard-reachable with tabIndex=0', () => {
    renderEditor(THREE_SECTIONS, vi.fn());
    for (const { id } of THREE_SECTIONS.sections) {
      expect(row(id).tabIndex).toBe(0);
    }
  });

  it('aria-selected on each row matches the section visible state', () => {
    const spec: CompositionSpec = {
      sections: [section('s0', 0, false), section('s1', 1, true)],
    };
    renderEditor(spec, vi.fn());
    expect(row('s0').getAttribute('aria-selected')).toBe('false');
    expect(row('s1').getAttribute('aria-selected')).toBe('true');
  });

  it('visible section renders all three density chips', () => {
    renderEditor(ONE_SECTION, vi.fn());
    for (const d of ALL_DENSITIES) {
      expect(chip('s0', d)).not.toBeNull();
    }
  });

  it('density chip group has role="group" and an aria-label containing the section id', () => {
    renderEditor(ONE_SECTION, vi.fn());
    const group = container.querySelector('[role="group"]') as HTMLElement | null;
    expect(group).not.toBeNull();
    expect(group!.getAttribute('aria-label')).toContain('s0');
  });

  it('density chips are absent for a hidden section', () => {
    renderEditor({ sections: [section('s0', 0, false)] }, vi.fn());
    expect(container.querySelector('[data-density]')).toBeNull();
  });
});

describe('CompositionEditor: density chip interaction', () => {
  it.each(ALL_DENSITIES)(
    'clicking the "%s" chip fires onChange with that density applied to the target section',
    (d) => {
      const calls: CompositionSpec[] = [];
      renderEditor(ONE_SECTION, (s) => calls.push(s));
      act(() => chip('s0', d).click());
      expect(calls).toHaveLength(1);
      expect(calls[0]!.sections.find((s) => s.id === 's0')?.density).toBe(d);
    },
  );

  it('the active chip carries aria-pressed=true; all other chips carry aria-pressed=false', () => {
    renderEditor({ sections: [section('s0', 0, true, 'compact')] }, vi.fn());
    expect(chip('s0', 'compact').getAttribute('aria-pressed')).toBe('true');
    expect(chip('s0', 'regular').getAttribute('aria-pressed')).toBe('false');
    expect(chip('s0', 'spacious').getAttribute('aria-pressed')).toBe('false');
  });

  it('clicking the already-active chip still fires onChange (not a silent no-op)', () => {
    const calls: CompositionSpec[] = [];
    renderEditor({ sections: [section('s0', 0, true, 'compact')] }, (s) => calls.push(s));
    act(() => chip('s0', 'compact').click());
    expect(calls).toHaveLength(1);
  });

  it('a density change on one section does not alter other sections', () => {
    const calls: CompositionSpec[] = [];
    renderEditor(THREE_SECTIONS, (s) => calls.push(s));
    act(() => chip('s0', 'spacious').click());
    const result = calls[0]!.sections;
    expect(result.find((s) => s.id === 's0')?.density).toBe('spacious');
    expect(result.find((s) => s.id === 's1')?.density).toBe('regular');
    expect(result.find((s) => s.id === 's2')?.density).toBe('regular');
  });

  it('clicking through all three density chips in sequence fires onChange for each click', () => {
    const received: Density[] = [];
    renderEditor(ONE_SECTION, (s) => received.push(s.sections[0]!.density));
    for (const d of ALL_DENSITIES) {
      act(() => chip('s0', d).click());
    }
    expect(received).toEqual([...ALL_DENSITIES]);
  });
});

describe('CompositionEditor: visibility toggle', () => {
  it('checkbox click fires onChange with visible toggled from true to false', () => {
    const calls: CompositionSpec[] = [];
    renderEditor(ONE_SECTION, (s) => calls.push(s));
    act(() => checkbox('s0').click());
    expect(calls).toHaveLength(1);
    expect(calls[0]!.sections.find((s) => s.id === 's0')?.visible).toBe(false);
  });

  it('checkbox click fires onChange with visible toggled from false to true', () => {
    const calls: CompositionSpec[] = [];
    renderEditor({ sections: [section('s0', 0, false)] }, (s) => calls.push(s));
    act(() => checkbox('s0').click());
    expect(calls).toHaveLength(1);
    expect(calls[0]!.sections.find((s) => s.id === 's0')?.visible).toBe(true);
  });

  it.each([['Enter', 'Enter'], ['Space', ' ']] as const)(
    '%s keydown on a row fires onChange with visible toggled',
    (_label, key) => {
      const calls: CompositionSpec[] = [];
      renderEditor(ONE_SECTION, (s) => calls.push(s));
      keydown(row('s0'), key);
      expect(calls).toHaveLength(1);
      expect(calls[0]!.sections.find((s) => s.id === 's0')?.visible).toBe(false);
    },
  );
});

describe('CompositionEditor: reorder buttons', () => {
  it('move-up is disabled for the first section (order=0)', () => {
    renderEditor(THREE_SECTIONS, vi.fn());
    expect(moveUp('s0').disabled).toBe(true);
  });

  it('move-down is disabled for the last section', () => {
    renderEditor(THREE_SECTIONS, vi.fn());
    expect(moveDown('s2').disabled).toBe(true);
  });

  it('both move-up and move-down are disabled when the spec has only one section', () => {
    renderEditor(ONE_SECTION, vi.fn());
    expect(moveUp('s0').disabled).toBe(true);
    expect(moveDown('s0').disabled).toBe(true);
  });

  it('both move-up and move-down are enabled for a middle section', () => {
    renderEditor(THREE_SECTIONS, vi.fn());
    expect(moveUp('s1').disabled).toBe(false);
    expect(moveDown('s1').disabled).toBe(false);
  });

  it('clicking move-down shifts the section one position later and keeps orders contiguous', () => {
    const calls: CompositionSpec[] = [];
    renderEditor(THREE_SECTIONS, (s) => calls.push(s));
    act(() => moveDown('s0').click());
    const sorted = calls[0]!.sections.slice().sort((a, b) => a.order - b.order);
    expect(sorted.map((s) => s.id)).toEqual(['s1', 's0', 's2']);
    expect(sorted.map((s) => s.order)).toEqual([0, 1, 2]);
  });

  it('clicking move-up shifts the section one position earlier and keeps orders contiguous', () => {
    const calls: CompositionSpec[] = [];
    renderEditor(THREE_SECTIONS, (s) => calls.push(s));
    act(() => moveUp('s2').click());
    const sorted = calls[0]!.sections.slice().sort((a, b) => a.order - b.order);
    expect(sorted.map((s) => s.id)).toEqual(['s0', 's2', 's1']);
    expect(sorted.map((s) => s.order)).toEqual([0, 1, 2]);
  });
});

describe('CompositionEditor: keyboard navigation', () => {
  it('ArrowDown on the first row fires onChange shifting that section one position later', () => {
    const calls: CompositionSpec[] = [];
    renderEditor(THREE_SECTIONS, (s) => calls.push(s));
    keydown(row('s0'), 'ArrowDown');
    expect(calls).toHaveLength(1);
    expect(sortedIds(calls[0]!)[0]).toBe('s1');
  });

  it('ArrowUp on the first row is a no-op (already at position 0)', () => {
    const calls: CompositionSpec[] = [];
    renderEditor(THREE_SECTIONS, (s) => calls.push(s));
    keydown(row('s0'), 'ArrowUp');
    expect(calls).toHaveLength(0);
  });

  it('ArrowDown on the last row is a no-op (already at last position)', () => {
    const calls: CompositionSpec[] = [];
    renderEditor(THREE_SECTIONS, (s) => calls.push(s));
    keydown(row('s2'), 'ArrowDown');
    expect(calls).toHaveLength(0);
  });

  it('ArrowUp on the last row fires onChange shifting that section one position earlier', () => {
    const calls: CompositionSpec[] = [];
    renderEditor(THREE_SECTIONS, (s) => calls.push(s));
    keydown(row('s2'), 'ArrowUp');
    expect(calls).toHaveLength(1);
    expect(sortedIds(calls[0]!)[1]).toBe('s2');
  });

  it('ArrowUp on a middle row fires onChange shifting that section one position earlier', () => {
    const calls: CompositionSpec[] = [];
    renderEditor(THREE_SECTIONS, (s) => calls.push(s));
    keydown(row('s1'), 'ArrowUp');
    expect(calls).toHaveLength(1);
    expect(sortedIds(calls[0]!)[0]).toBe('s1');
  });

  it('ArrowDown on a middle row fires onChange shifting that section one position later', () => {
    const calls: CompositionSpec[] = [];
    renderEditor(THREE_SECTIONS, (s) => calls.push(s));
    keydown(row('s1'), 'ArrowDown');
    expect(calls).toHaveLength(1);
    expect(sortedIds(calls[0]!)[2]).toBe('s1');
  });
});

describe('CompositionEditor: drag-and-drop reorder', () => {
  it('dragstart on one row then drop on a different row fires onChange with those rows swapped', () => {
    const calls: CompositionSpec[] = [];
    renderEditor(THREE_SECTIONS, (s) => calls.push(s));
    act(() => row('s0').dispatchEvent(new Event('dragstart', { bubbles: true })));
    act(() => row('s1').dispatchEvent(new Event('drop', { bubbles: true })));
    expect(calls).toHaveLength(1);
    const sorted = sortedIds(calls[0]!);
    expect(sorted[0]).toBe('s1');
    expect(sorted[1]).toBe('s0');
  });

  it('dragstart and drop on the same row is a no-op', () => {
    const calls: CompositionSpec[] = [];
    renderEditor(THREE_SECTIONS, (s) => calls.push(s));
    act(() => row('s0').dispatchEvent(new Event('dragstart', { bubbles: true })));
    act(() => row('s0').dispatchEvent(new Event('drop', { bubbles: true })));
    expect(calls).toHaveLength(0);
  });
});

describe('CompositionEditor: onChange immutability', () => {
  it('onChange delivers a new spec object, not the original reference', () => {
    let received: CompositionSpec | null = null;
    renderEditor(ONE_SECTION, (s) => { received = s; });
    act(() => chip('s0', 'compact').click());
    expect(received).not.toBeNull();
    expect(received).not.toBe(ONE_SECTION);
  });

  it('the original spec object is not mutated by any editor interaction', () => {
    const snapshot = JSON.stringify(ONE_SECTION);
    renderEditor(ONE_SECTION, vi.fn());
    act(() => chip('s0', 'compact').click());
    expect(JSON.stringify(ONE_SECTION)).toBe(snapshot);
  });
});

describe('CompositionEditor: Reset button', () => {
  it('clicking Reset fires onReset exactly once per click', () => {
    const onReset = vi.fn();
    act(() => {
      root.render(
        React.createElement(CompositionEditor, {
          spec: ONE_SECTION,
          onChange: vi.fn(),
          onReset,
        }),
      );
    });
    const btn = [...container.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Reset',
    ) as HTMLButtonElement;
    expect(btn).not.toBeNull();
    act(() => btn.click());
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
