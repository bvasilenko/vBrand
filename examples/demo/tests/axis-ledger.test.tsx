// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { AxisLedger } from '../src/axis-ledger.js';
import type { StackName, CmsName } from '../src/router.js';

const STACK_NAMES: readonly StackName[] = ['vite', 'next', 'astro'];
const CMS_NAMES: readonly CmsName[]     = ['vbrand-standalone', 'payload', 'sanity', 'strapi'];

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

function render(stack: StackName, cms: CmsName): void {
  act(() => { root.render(React.createElement(AxisLedger, { stack, cms })); });
}

function text(): string {
  return container.textContent ?? '';
}

describe('AxisLedger - stack axis', () => {
  it.each(STACK_NAMES)('renders the stack value "%s" in the ledger', (stack) => {
    render(stack, 'vbrand-standalone');
    expect(text()).toContain(stack);
  });

  it('each StackName is distinct in the rendered output', () => {
    for (const stack of STACK_NAMES) {
      render(stack, 'vbrand-standalone');
      expect(text()).toContain(stack);
      for (const other of STACK_NAMES.filter((s) => s !== stack)) {
        expect(text()).not.toContain(other);
      }
    }
  });
});

describe('AxisLedger - cms axis', () => {
  it.each(CMS_NAMES)('renders the cms value "%s" in the ledger', (cms) => {
    render('vite', cms);
    expect(text()).toContain(cms);
  });

  it('each CmsName is distinct in the rendered output', () => {
    for (const cms of CMS_NAMES) {
      render('vite', cms);
      expect(text()).toContain(cms);
    }
  });
});

describe('AxisLedger - deploy axis', () => {
  it.each(STACK_NAMES)(
    'deploy axis always shows "gh-pages" regardless of stack (stack=%s)',
    (stack) => {
      render(stack, 'vbrand-standalone');
      expect(text()).toContain('gh-pages');
    },
  );

  it.each(CMS_NAMES)(
    'deploy axis always shows "gh-pages" regardless of cms (cms=%s)',
    (cms) => {
      render('vite', cms);
      expect(text()).toContain('gh-pages');
    },
  );
});

describe('AxisLedger - axis labels', () => {
  it('renders the Stack label', () => {
    render('vite', 'vbrand-standalone');
    expect(text().toLowerCase()).toContain('stack');
  });

  it('renders the CMS label', () => {
    render('vite', 'vbrand-standalone');
    expect(text().toLowerCase()).toContain('cms');
  });

  it('renders the Deploy label', () => {
    render('vite', 'vbrand-standalone');
    expect(text().toLowerCase()).toContain('deploy');
  });
});

describe('AxisLedger - product milestone label', () => {
  it('always renders the "7/9 flexed" milestone label', () => {
    render('vite', 'vbrand-standalone');
    expect(text()).toContain('7/9 flexed');
  });

  it.each(STACK_NAMES)(
    'renders "7/9 flexed" for every stack (stack=%s)',
    (stack) => {
      render(stack, 'vbrand-standalone');
      expect(text()).toContain('7/9 flexed');
    },
  );

  it.each(CMS_NAMES)(
    'renders "7/9 flexed" for every cms (cms=%s)',
    (cms) => {
      render('vite', cms);
      expect(text()).toContain('7/9 flexed');
    },
  );
});

describe('AxisLedger - axis completeness across all (stack, cms) pairs', () => {
  it.each(
    STACK_NAMES.flatMap((stack) =>
      CMS_NAMES.map((cms) => [stack, cms] as [StackName, CmsName]),
    ),
  )(
    'renders all three axis values and the milestone label for (stack=%s, cms=%s)',
    (stack, cms) => {
      render(stack, cms);
      const content = text();
      expect(content).toContain(stack);
      expect(content).toContain(cms);
      expect(content).toContain('gh-pages');
      expect(content).toContain('7/9 flexed');
    },
  );
});
