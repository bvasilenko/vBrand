// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ParkNotice } from '../src/park-notice';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  sessionStorage.clear();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  sessionStorage.clear();
});

function render(search: string) {
  act(() => root.render(React.createElement(ParkNotice, { search })));
}

const SHIPPED_AXIS_SEARCHES = [
  '?stack=next',
  '?cms=strapi',
  '?stack=astro&cms=sanity&mode=static',
] as const;

const QUEUED_AXIS_CASES = [
  ['?deploy=netlify', ['multi-deploy target selection']],
  ['?stackPlugin=remix', ['expanded stack runtime plugins']],
  ['?cmsLive=sanity', ['managed CMS live instances']],
  ['?deploy=netlify&stackPlugin=remix', ['multi-deploy target selection', 'expanded stack runtime plugins']],
] as const;

describe('ParkNotice: alpha.5 shipped axes', () => {
  it.each(SHIPPED_AXIS_SEARCHES)('does not warn for shipped axis params: %s', (search) => {
    render(search);
    expect(container.querySelector('[role="banner"]')).toBeNull();
  });

  it.each(QUEUED_AXIS_CASES)('keeps future queued-axis notices available: %s', (search, labels) => {
    render(search);
    const banner = container.querySelector('[role="banner"]');
    for (const label of labels) expect(banner?.textContent).toContain(label);
    expect(banner?.textContent).toContain('vBrand 0.5.0');
  });

  it.each(QUEUED_AXIS_CASES)('dismisses future queued-axis notices for the current session: %s', (search) => {
    render(search);
    const dismiss = container.querySelector('[aria-label="Dismiss queued axes notice"]') as HTMLButtonElement;
    act(() => dismiss.click());
    expect(container.querySelector('[role="banner"]')).toBeNull();
    expect(sessionStorage.getItem('vbrand-park-notice-dismissed')).toBe('1');
  });

  it.each(QUEUED_AXIS_CASES)('honors an existing queued-notice session dismissal: %s', (search) => {
    sessionStorage.setItem('vbrand-park-notice-dismissed', '1');
    render(search);
    expect(container.querySelector('[role="banner"]')).toBeNull();
  });

  it.each(['', '?foo=bar', '?mode=spa&content=x'])('does not warn for unrelated params: %s', (search) => {
    render(search);
    expect(container.querySelector('[role="banner"]')).toBeNull();
  });
});
