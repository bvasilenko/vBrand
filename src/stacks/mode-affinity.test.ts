// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { describe, expect, it } from 'vitest';
import { deriveTargetMode } from './mode-affinity.js';
import type { InteractivityMode } from '../interactivity/mode.js';
import type { StackName } from './types.js';

const STACK_DEFAULTS: Record<StackName, InteractivityMode> = {
  vite: 'spa',
  next: 'hybrid',
  astro: 'static',
};

const ALL_STACKS: readonly StackName[] = ['vite', 'next', 'astro'];
const ALL_MODES: readonly InteractivityMode[] = ['static', 'hybrid', 'spa'];

describe('deriveTargetMode - identity when stack does not change', () => {
  it.each(ALL_STACKS)('stack=%s with its own default mode returns that default unchanged', (stack) => {
    const mode = STACK_DEFAULTS[stack];
    expect(deriveTargetMode(mode, stack, stack)).toBe(mode);
  });

  it.each(ALL_MODES)(
    'mode="%s" on vite returning to vite preserves mode without consulting target default',
    (mode) => {
      expect(deriveTargetMode(mode, 'vite', 'vite')).toBe(mode);
    },
  );
});

describe('deriveTargetMode - mode follows stack default when user was on the previous stack default', () => {
  it('vite(spa default) -> astro: resolves to astro default (static)', () => {
    expect(deriveTargetMode('spa', 'vite', 'astro')).toBe('static');
  });

  it('vite(spa default) -> next: resolves to next default (hybrid)', () => {
    expect(deriveTargetMode('spa', 'vite', 'next')).toBe('hybrid');
  });

  it('next(hybrid default) -> vite: resolves to vite default (spa)', () => {
    expect(deriveTargetMode('hybrid', 'next', 'vite')).toBe('spa');
  });

  it('next(hybrid default) -> astro: resolves to astro default (static)', () => {
    expect(deriveTargetMode('hybrid', 'next', 'astro')).toBe('static');
  });

  it('astro(static default) -> vite: resolves to vite default (spa)', () => {
    expect(deriveTargetMode('static', 'astro', 'vite')).toBe('spa');
  });

  it('astro(static default) -> next: resolves to next default (hybrid)', () => {
    expect(deriveTargetMode('static', 'astro', 'next')).toBe('hybrid');
  });
});

describe('deriveTargetMode - explicit non-default mode is preserved across any stack switch', () => {
  it('vite(hybrid - explicit) -> astro: hybrid is preserved', () => {
    expect(deriveTargetMode('hybrid', 'vite', 'astro')).toBe('hybrid');
  });

  it('vite(static - explicit) -> next: static is preserved', () => {
    expect(deriveTargetMode('static', 'vite', 'next')).toBe('static');
  });

  it('next(spa - explicit) -> vite: spa is preserved', () => {
    expect(deriveTargetMode('spa', 'next', 'vite')).toBe('spa');
  });

  it('next(static - explicit) -> astro: static is preserved', () => {
    expect(deriveTargetMode('static', 'next', 'astro')).toBe('static');
  });

  it('astro(spa - explicit) -> vite: spa is preserved', () => {
    expect(deriveTargetMode('spa', 'astro', 'vite')).toBe('spa');
  });

  it('astro(hybrid - explicit) -> next: hybrid is preserved', () => {
    expect(deriveTargetMode('hybrid', 'astro', 'next')).toBe('hybrid');
  });

  it('astro(spa - explicit) -> next: spa is preserved (spa != astro default static)', () => {
    expect(deriveTargetMode('spa', 'astro', 'next')).toBe('spa');
  });

  it('next(spa - explicit) -> astro: spa is preserved (spa != next default hybrid)', () => {
    expect(deriveTargetMode('spa', 'next', 'astro')).toBe('spa');
  });
});

describe('deriveTargetMode - exhaustive cross-stack parity', () => {
  it.each(ALL_STACKS.flatMap((from) =>
    ALL_STACKS.filter((to) => to !== from).map((to) => ({ from, to })),
  ))(
    'switching from $from(default) to $to always resolves to $to default',
    ({ from, to }) => {
      expect(deriveTargetMode(STACK_DEFAULTS[from], from, to)).toBe(STACK_DEFAULTS[to]);
    },
  );

  it.each(ALL_STACKS.flatMap((from) =>
    ALL_MODES.filter((m) => m !== STACK_DEFAULTS[from]).flatMap((mode) =>
      ALL_STACKS.filter((to) => to !== from).map((to) => ({ from, to, mode })),
    ),
  ))(
    'switching from $from(explicit $mode) to $to preserves $mode',
    ({ from, to, mode }) => {
      expect(deriveTargetMode(mode, from, to)).toBe(mode);
    },
  );
});
