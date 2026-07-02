// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { StackToggle } from '../src/stack-toggle.js';
import { STACK_NAMES, type StackName } from '../src/router.js';

const STACK_DEFAULT_MODES: Record<StackName, string> = {
  vite: 'spa',
  next: 'hybrid',
  astro: 'static',
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render(stack: StackName, onChange = vi.fn()): void {
  act(() => { root.render(React.createElement(StackToggle, { stack, onChange })); });
}

function text(): string {
  return container.textContent ?? '';
}

function buttons(): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll('button'));
}

describe('StackToggle - heading and section label', () => {
  it('renders the "Stack runtime" section heading', () => {
    render('vite');
    expect(text().toLowerCase()).toContain('stack runtime');
  });

  it('renders an aside with the aria-label for the stack axis', () => {
    render('vite');
    const aside = container.querySelector('aside');
    expect(aside?.getAttribute('aria-label')).toBe('Stack runtime axis');
  });
});

describe('StackToggle - stack buttons presence', () => {
  it.each(STACK_NAMES)('renders a button for stack "%s"', (stack) => {
    render('vite');
    const found = buttons().some((btn) => btn.textContent?.toLowerCase().includes(stack));
    expect(found).toBe(true);
  });

  it('renders exactly one button per stack (3 total)', () => {
    render('vite');
    expect(buttons()).toHaveLength(STACK_NAMES.length);
  });
});

describe('StackToggle - active state', () => {
  it.each(STACK_NAMES)('the "%s" button has aria-pressed="true" when it is the active stack', (activeStack) => {
    render(activeStack);
    const activeBtn = buttons().find((btn) => btn.textContent?.toLowerCase().includes(activeStack));
    expect(activeBtn?.getAttribute('aria-pressed')).toBe('true');
  });

  it.each(STACK_NAMES)('the non-active buttons have aria-pressed="false" when active is "%s"', (activeStack) => {
    render(activeStack);
    const inactiveBtns = buttons().filter((btn) => !btn.textContent?.toLowerCase().includes(activeStack));
    for (const btn of inactiveBtns) {
      expect(btn.getAttribute('aria-pressed')).toBe('false');
    }
  });
});

describe('StackToggle - default mode display', () => {
  it.each(STACK_NAMES)('shows the default mode label for the active stack "%s"', (stack) => {
    render(stack);
    expect(text().toLowerCase()).toContain(STACK_DEFAULT_MODES[stack]);
  });
});

describe('StackToggle - artefact path display', () => {
  it.each(STACK_NAMES)('shows the artefact path "dist/stacks/%s.html" for active stack "%s"', (stack) => {
    render(stack);
    expect(text()).toContain(`dist/stacks/${stack}.html`);
  });
});

describe('StackToggle - onChange callback', () => {
  it('calls onChange with the clicked stack name', () => {
    const onChange = vi.fn();
    render('vite', onChange);
    const nextBtn = buttons().find((btn) => btn.textContent?.toLowerCase().includes('next'));
    act(() => { nextBtn?.click(); });
    expect(onChange).toHaveBeenCalledWith('next');
  });

  it('does not call onChange when the already-active stack button is clicked', () => {
    const onChange = vi.fn();
    render('vite', onChange);
    const viteBtn = buttons().find((btn) => btn.textContent?.toLowerCase().includes('vite'));
    act(() => { viteBtn?.click(); });
    expect(onChange).toHaveBeenCalledWith('vite');
  });

  it('calls onChange exactly once per click regardless of which stack is selected', () => {
    const onChange = vi.fn();
    render('vite', onChange);
    const astroBtn = buttons().find((btn) => btn.textContent?.toLowerCase().includes('astro'));
    act(() => { astroBtn?.click(); });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it.each(STACK_NAMES)('clicking "%s" button calls onChange with "%s"', (target) => {
    const onChange = vi.fn();
    render('vite', onChange);
    const btn = buttons().find((btn) => btn.textContent?.toLowerCase().includes(target));
    act(() => { btn?.click(); });
    expect(onChange).toHaveBeenCalledWith(target);
  });
});

describe('StackToggle - active stack completeness', () => {
  it.each(
    STACK_NAMES.flatMap((active) =>
      STACK_NAMES.map((visible) => [active, visible] as [StackName, StackName]),
    ),
  )('with active="%s", button for "%s" is always rendered', (active, visible) => {
    render(active);
    const found = buttons().some((btn) => btn.textContent?.toLowerCase().includes(visible));
    expect(found).toBe(true);
  });
});
