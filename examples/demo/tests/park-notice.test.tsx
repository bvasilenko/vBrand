// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ParkNotice } from '../src/park-notice.js';

const SESSION_KEY = 'vbrand-park-notice-dismissed';

const QUEUED_AXIS_CASES = [
  { param: 'stack',   value: 'vite',                label: 'stack-runtime',     iteration: 'iteration 3 queued' },
  { param: 'cms',     value: 'vbrand',              label: 'cms substrate',     iteration: 'iteration 3 queued' },
  { param: 'mode',    value: 'static',              label: 'interactivity mode',iteration: 'iteration 2 queued' },
  { param: 'content', value: 'hero.headline:Hello', label: 'content override',  iteration: 'iteration 2 queued' },
] as const;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  sessionStorage.removeItem(SESSION_KEY);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  sessionStorage.removeItem(SESSION_KEY);
});

function render(search: string) {
  act(() => root.render(React.createElement(ParkNotice, { search })));
}

describe('ParkNotice: visibility rules', () => {
  it('renders nothing when no queued-axis params are present', () => {
    render('?brand=fixture:stripe');
    expect(container.querySelector('[role="banner"]')).toBeNull();
  });

  it('renders nothing when unrecognised params are present', () => {
    render('?foo=bar&baz=1');
    expect(container.querySelector('[role="banner"]')).toBeNull();
  });

  it.each(QUEUED_AXIS_CASES)(
    '?$param=$value: banner is rendered',
    ({ param, value }) => {
      render(`?${param}=${value}`);
      expect(container.querySelector('[role="banner"]')).not.toBeNull();
    },
  );

  it('renders a banner when the param is present with an empty value', () => {
    render('?stack=');
    expect(container.querySelector('[role="banner"]')).not.toBeNull();
  });

  it('renders one banner listing all present axes when multiple queued-axis params are present', () => {
    render('?stack=vite&mode=static');
    const banner = container.querySelector('[role="banner"]');
    expect(banner).not.toBeNull();
    expect(banner!.textContent).toContain('stack-runtime');
    expect(banner!.textContent).toContain('interactivity mode');
  });
});

describe('ParkNotice: axis label and iteration text', () => {
  it.each(QUEUED_AXIS_CASES)(
    '?$param: shows label "$label" and iteration text "$iteration"',
    ({ param, value, label, iteration }) => {
      render(`?${param}=${value}`);
      const text = container.querySelector('[role="banner"]')!.textContent ?? '';
      expect(text).toContain(label);
      expect(text).toContain(iteration);
    },
  );
});

describe('ParkNotice: dismiss behaviour', () => {
  it('clicking dismiss removes the banner from the DOM', () => {
    render('?stack=vite');
    const dismiss = container.querySelector('[aria-label="Dismiss queued axes notice"]') as HTMLButtonElement;
    act(() => dismiss.click());
    expect(container.querySelector('[role="banner"]')).toBeNull();
  });

  it('clicking dismiss writes the session flag', () => {
    render('?stack=vite');
    const dismiss = container.querySelector('[aria-label="Dismiss queued axes notice"]') as HTMLButtonElement;
    act(() => dismiss.click());
    expect(sessionStorage.getItem(SESSION_KEY)).toBe('1');
  });

  it('banner does not render when session flag is already set', () => {
    sessionStorage.setItem(SESSION_KEY, '1');
    render('?stack=vite');
    expect(container.querySelector('[role="banner"]')).toBeNull();
  });

  it('session flag set before render suppresses banner for every queued-axis param', () => {
    sessionStorage.setItem(SESSION_KEY, '1');
    for (const { param, value } of QUEUED_AXIS_CASES) {
      render(`?${param}=${value}`);
      expect(container.querySelector('[role="banner"]')).toBeNull();
    }
  });
});
