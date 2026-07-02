// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { CmsToggle } from '../src/cms-toggle.js';
import { CMS_NAMES, type CmsName } from '../src/router.js';

const CMS_LABELS: Record<CmsName, string> = {
  'vbrand-standalone': 'vbrand',
  payload: 'payload',
  sanity: 'sanity',
  strapi: 'strapi',
};

const CMS_CONTRACT_KEYWORDS: Record<CmsName, string> = {
  'vbrand-standalone': 'schema as content',
  payload: 'collections normalizer',
  sanity: 'groq normalizer',
  strapi: 'content-type normalizer',
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

function render(cms: CmsName, onChange = vi.fn()): void {
  act(() => { root.render(React.createElement(CmsToggle, { cms, onChange })); });
}

function text(): string {
  return container.textContent ?? '';
}

function buttons(): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll('button'));
}

describe('CmsToggle - heading and section label', () => {
  it('renders the "CMS substrate" section heading', () => {
    render('vbrand-standalone');
    expect(text().toLowerCase()).toContain('cms substrate');
  });

  it('renders an aside with the aria-label for the CMS substrate axis', () => {
    render('vbrand-standalone');
    const aside = container.querySelector('aside');
    expect(aside?.getAttribute('aria-label')).toBe('CMS substrate axis');
  });
});

describe('CmsToggle - CMS buttons presence', () => {
  it.each(CMS_NAMES)('renders a button for substrate "%s"', (cms) => {
    render('vbrand-standalone');
    const labelFragment = CMS_LABELS[cms];
    const found = buttons().some((btn) => btn.textContent?.toLowerCase().includes(labelFragment));
    expect(found).toBe(true);
  });

  it('renders exactly one button per CMS substrate (4 total)', () => {
    render('vbrand-standalone');
    expect(buttons()).toHaveLength(CMS_NAMES.length);
  });
});

describe('CmsToggle - active state', () => {
  it.each(CMS_NAMES)('the "%s" button has aria-pressed="true" when it is the active substrate', (activeCms) => {
    render(activeCms);
    const activeBtn = buttons().find((btn) =>
      btn.textContent?.toLowerCase().includes(CMS_LABELS[activeCms]),
    );
    expect(activeBtn?.getAttribute('aria-pressed')).toBe('true');
  });

  it.each(CMS_NAMES)('the non-active buttons have aria-pressed="false" when active is "%s"', (activeCms) => {
    render(activeCms);
    const activeLabel = CMS_LABELS[activeCms];
    const inactiveBtns = buttons().filter((btn) =>
      !btn.textContent?.toLowerCase().includes(activeLabel),
    );
    for (const btn of inactiveBtns) {
      expect(btn.getAttribute('aria-pressed')).toBe('false');
    }
  });
});

describe('CmsToggle - contract keyword display for active substrate', () => {
  it.each(CMS_NAMES)('shows the contract keyword for active substrate "%s"', (cms) => {
    render(cms);
    expect(text().toLowerCase()).toContain(CMS_CONTRACT_KEYWORDS[cms]);
  });
});

describe('CmsToggle - source path display for active substrate', () => {
  it('shows the "source" label for the active substrate detail', () => {
    render('payload');
    expect(text().toLowerCase()).toContain('source');
  });

  it('shows the "normalizer" label for the active substrate detail', () => {
    render('payload');
    expect(text().toLowerCase()).toContain('normalizer');
  });
});

describe('CmsToggle - onChange callback', () => {
  it('calls onChange with the clicked CMS name', () => {
    const onChange = vi.fn();
    render('vbrand-standalone', onChange);
    const payloadBtn = buttons().find((btn) =>
      btn.textContent?.toLowerCase().includes(CMS_LABELS['payload']),
    );
    act(() => { payloadBtn?.click(); });
    expect(onChange).toHaveBeenCalledWith('payload');
  });

  it('calls onChange exactly once per click', () => {
    const onChange = vi.fn();
    render('vbrand-standalone', onChange);
    const strapiBtn = buttons().find((btn) =>
      btn.textContent?.toLowerCase().includes(CMS_LABELS['strapi']),
    );
    act(() => { strapiBtn?.click(); });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it.each(CMS_NAMES)('clicking "%s" button calls onChange with "%s"', (target) => {
    const onChange = vi.fn();
    render('vbrand-standalone', onChange);
    const btn = buttons().find((btn) =>
      btn.textContent?.toLowerCase().includes(CMS_LABELS[target]),
    );
    act(() => { btn?.click(); });
    expect(onChange).toHaveBeenCalledWith(target);
  });
});

describe('CmsToggle - substrate completeness across all active values', () => {
  it.each(
    CMS_NAMES.flatMap((active) =>
      CMS_NAMES.map((visible) => [active, visible] as [CmsName, CmsName]),
    ),
  )('with active="%s", button for "%s" is always rendered', (active, visible) => {
    render(active);
    const found = buttons().some((btn) =>
      btn.textContent?.toLowerCase().includes(CMS_LABELS[visible]),
    );
    expect(found).toBe(true);
  });
});
