// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ParkNotice } from '../src/park-notice.js';

const SESSION_KEY = 'vbrand-park-notice-dismissed';

const QUEUED_AXIS_CASES = [
  { param: 'stack', value: 'vite',   label: 'stack-runtime', iteration: 'iteration 3 queued' },
  { param: 'cms',   value: 'vbrand', label: 'cms substrate', iteration: 'iteration 3 queued' },
] as const;

const SHIPPED_AXIS_PARAMS = ['mode', 'content'] as const;

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

function banner(): Element | null {
  return container.querySelector('[role="banner"]');
}


describe('ParkNotice: visibility rules', () => {
  it('renders nothing when no queued-axis params are present', () => {
    render('?brand=fixture:stripe');
    expect(banner()).toBeNull();
  });

  it('renders nothing when the search string is completely empty', () => {
    render('');
    expect(banner()).toBeNull();
  });

  it('renders nothing when only unrecognised params are present', () => {
    render('?foo=bar&baz=1');
    expect(banner()).toBeNull();
  });

  it.each(QUEUED_AXIS_CASES)(
    '?$param=$value: banner is rendered for queued axis',
    ({ param, value }) => {
      render(`?${param}=${value}`);
      expect(banner()).not.toBeNull();
    },
  );

  it('renders a banner when a queued-axis param is present with an empty value', () => {
    render('?stack=');
    expect(banner()).not.toBeNull();
  });

  it('renders exactly one banner element when multiple queued-axis params are present', () => {
    render('?stack=vite&cms=vbrand');
    expect(container.querySelectorAll('[role="banner"]').length).toBe(1);
  });

  it.each(SHIPPED_AXIS_PARAMS)(
    '?%s: shipped axis does not trigger the banner',
    (param) => {
      render(`?${param}=anything`);
      expect(banner()).toBeNull();
    },
  );

  it('no banner when all present params are shipped axes', () => {
    render('?mode=static&content=some.key:value');
    expect(banner()).toBeNull();
  });

  it('banner renders when a queued-axis param accompanies a shipped-axis param', () => {
    render('?stack=vite&mode=static');
    expect(banner()).not.toBeNull();
  });
});


describe('ParkNotice: axis label and iteration text', () => {
  it.each(QUEUED_AXIS_CASES)(
    '?$param: banner contains the axis label "$label"',
    ({ param, value, label }) => {
      render(`?${param}=${value}`);
      expect(banner()!.textContent).toContain(label);
    },
  );

  it.each(QUEUED_AXIS_CASES)(
    '?$param: banner contains the iteration text "$iteration"',
    ({ param, value, iteration }) => {
      render(`?${param}=${value}`);
      expect(banner()!.textContent).toContain(iteration);
    },
  );

  it('banner listing two queued axes contains both labels', () => {
    render('?stack=vite&cms=vbrand');
    expect(banner()!.textContent).toContain('stack-runtime');
    expect(banner()!.textContent).toContain('cms substrate');
  });

  it('banner with queued + shipped param includes the queued label but not the shipped label', () => {
    render('?stack=vite&mode=static');
    expect(banner()!.textContent).toContain('stack-runtime');
    expect(banner()!.textContent).not.toContain('interactivity mode');
  });

  it('banner with queued + shipped param includes the queued label but not the other shipped label', () => {
    render('?cms=vbrand&content=anything');
    expect(banner()!.textContent).toContain('cms substrate');
    expect(banner()!.textContent).not.toContain('content override');
  });
});


describe('ParkNotice: dismiss behaviour', () => {
  it('clicking dismiss removes the banner from the DOM', () => {
    render('?stack=vite');
    const dismiss = container.querySelector('[aria-label="Dismiss queued axes notice"]') as HTMLButtonElement;
    act(() => dismiss.click());
    expect(banner()).toBeNull();
  });

  it('clicking dismiss writes the session flag', () => {
    render('?stack=vite');
    const dismiss = container.querySelector('[aria-label="Dismiss queued axes notice"]') as HTMLButtonElement;
    act(() => dismiss.click());
    expect(sessionStorage.getItem(SESSION_KEY)).toBe('1');
  });

  it('banner does not render when session flag is already set before mount', () => {
    sessionStorage.setItem(SESSION_KEY, '1');
    render('?stack=vite');
    expect(banner()).toBeNull();
  });

  it('session flag set before render suppresses banner for every queued-axis param', () => {
    sessionStorage.setItem(SESSION_KEY, '1');
    for (const { param, value } of QUEUED_AXIS_CASES) {
      render(`?${param}=${value}`);
      expect(banner()).toBeNull();
    }
  });

  it('dismiss button has the expected aria-label for accessibility', () => {
    render('?stack=vite');
    const dismiss = container.querySelector('[aria-label="Dismiss queued axes notice"]');
    expect(dismiss).not.toBeNull();
  });
});
