// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { NavBar } from '../src/nav-bar.js';
import { buildSearchString, parseRoute, DEFAULT_MODE, type TemplateId, type InteractivityMode } from '../src/router.js';

const ALL_TEMPLATE_IDS: readonly TemplateId[] = ['landing', 'marketing', 'docs', 'dashboard'];

const FIXTURE_BRANDS = [
  'fixture:stripe',
  'fixture:vercel',
  'fixture:linear',
  'fixture:github',
  'fixture:notion',
] as const;

let container: HTMLDivElement;
let root: Root;
let navigations: string[];
let hrefNavigations: string[];

beforeEach(() => {
  navigations = [];
  hrefNavigations = [];
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  vi.stubGlobal('location', {
    search: '',
    pathname: '/',
    hash: '#existing-hash',
    set search(val: string) { navigations.push(val); },
    get search() { return navigations[navigations.length - 1] ?? ''; },
    set href(val: string) {
      hrefNavigations.push(val);
      const url = new URL(val, 'http://localhost');
      navigations.push(url.search.slice(1));
    },
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

interface NavBarOverrides {
  currentMode?: InteractivityMode;
  currentBrand?: string;
  currentTemplate?: TemplateId;
  isLoading?: boolean;
  dataViewHref?: string;
  onDataViewNavigate?: () => void;
}

function renderNavBar(overrides: NavBarOverrides = {}): void {
  act(() => {
    root.render(
      React.createElement(NavBar, {
        currentBrand: 'fixture:stripe',
        currentTemplate: 'landing',
        isLoading: false,
        dataViewHref: '/vBrand/data',
        onDataViewNavigate: () => undefined,
        ...overrides,
      }),
    );
  });
}

function templateSelect(): HTMLSelectElement {
  return container.querySelector('select') as HTMLSelectElement;
}

function brandInput(): HTMLInputElement {
  return container.querySelector('input') as HTMLInputElement;
}

function loadButton(): HTMLButtonElement {
  return [...container.querySelectorAll('button')].find(
    (b) => /^Load/.test(b.textContent?.trim() ?? ''),
  ) as HTMLButtonElement;
}

function dataViewLink(): HTMLAnchorElement {
  return container.querySelector('a[href]') as HTMLAnchorElement;
}

function exampleButtons(): HTMLButtonElement[] {
  return [...container.querySelectorAll('details button')] as HTMLButtonElement[];
}

function changeTemplateSelect(id: TemplateId): void {
  act(() => {
    const sel = templateSelect();
    sel.value = id;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function clickLoad(): void {
  act(() => loadButton().click());
}

function pressEnterInBrandInput(): void {
  act(() => {
    brandInput().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  });
}

describe('NavBar: template select reflects currentTemplate prop', () => {
  it.each(ALL_TEMPLATE_IDS)(
    'currentTemplate="%s": select.value matches the prop',
    (id) => {
      renderNavBar({ currentTemplate: id });
      expect(templateSelect().value).toBe(id);
    },
  );

  it('all four known template IDs are offered as option values', () => {
    renderNavBar();
    const offered = [...templateSelect().options].map((o) => o.value);
    expect(offered).toEqual(expect.arrayContaining([...ALL_TEMPLATE_IDS]));
    expect(offered).toHaveLength(ALL_TEMPLATE_IDS.length);
  });
});

describe('NavBar: template select change triggers immediate navigation', () => {
  it.each(ALL_TEMPLATE_IDS)(
    'selecting "%s" causes exactly one navigation call',
    (id) => {
      renderNavBar({ currentTemplate: 'landing' });
      changeTemplateSelect(id);
      expect(navigations).toHaveLength(1);
    },
  );

  it.each(ALL_TEMPLATE_IDS)(
    'navigation from selecting "%s" carries app=%s',
    (id) => {
      renderNavBar({ currentTemplate: 'landing' });
      changeTemplateSelect(id);
      expect(new URLSearchParams(navigations[0]).get('app')).toBe(id);
    },
  );

  it('navigation carries the brand value that was in the input at time of template change', () => {
    renderNavBar({ currentTemplate: 'landing', currentBrand: 'fixture:vercel' });
    changeTemplateSelect('docs');
    expect(new URLSearchParams(navigations[0]).get('brand')).toBe('fixture:vercel');
  });

  it('navigation with empty brand omits the brand param entirely', () => {
    renderNavBar({ currentTemplate: 'landing', currentBrand: '' });
    changeTemplateSelect('docs');
    expect(new URLSearchParams(navigations[0]).get('brand')).toBeNull();
  });

  it('navigation search string equals buildSearchString(currentBrand, newTemplate)', () => {
    renderNavBar({ currentTemplate: 'landing', currentBrand: 'fixture:linear' });
    changeTemplateSelect('marketing');
    expect(navigations[0]).toBe(buildSearchString('fixture:linear', 'marketing'));
  });

  it('navigation search string is round-trip parseable by parseRoute', () => {
    renderNavBar({ currentTemplate: 'landing', currentBrand: 'fixture:notion' });
    changeTemplateSelect('dashboard');
    const route = parseRoute(navigations[0]!);
    expect(route.templateId).toBe('dashboard');
    expect(route.brandParams).toEqual({ type: 'fixture', handle: 'notion' });
  });

  it('successive template selections each produce exactly one navigation call per change', () => {
    renderNavBar({ currentTemplate: 'landing', currentBrand: 'fixture:stripe' });
    changeTemplateSelect('docs');
    changeTemplateSelect('dashboard');
    changeTemplateSelect('marketing');
    expect(navigations).toHaveLength(3);
  });

  it('each successive selection carries the correct template in its navigation', () => {
    renderNavBar({ currentTemplate: 'landing', currentBrand: 'fixture:stripe' });
    const sequence: TemplateId[] = ['docs', 'dashboard', 'marketing'];
    for (const id of sequence) changeTemplateSelect(id);
    for (const [i, id] of sequence.entries()) {
      expect(new URLSearchParams(navigations[i]).get('app')).toBe(id);
    }
  });

  it.each(FIXTURE_BRANDS)(
    'brand "%s" is preserved across a template change',
    (brand) => {
      renderNavBar({ currentTemplate: 'landing', currentBrand: brand });
      changeTemplateSelect('docs');
      expect(new URLSearchParams(navigations[0]).get('brand')).toBe(brand);
    },
  );
});

describe('NavBar: Load button triggers navigation with currentTemplate prop', () => {
  it.each(ALL_TEMPLATE_IDS)(
    'Load with currentTemplate="%s" carries app=%s',
    (id) => {
      renderNavBar({ currentTemplate: id });
      clickLoad();
      expect(new URLSearchParams(navigations[0]).get('app')).toBe(id);
    },
  );

  it('Load navigation carries the brand from the input', () => {
    renderNavBar({ currentTemplate: 'docs', currentBrand: 'fixture:github' });
    clickLoad();
    expect(new URLSearchParams(navigations[0]).get('brand')).toBe('fixture:github');
  });

  it('Load with empty brand omits the brand param', () => {
    renderNavBar({ currentTemplate: 'marketing', currentBrand: '' });
    clickLoad();
    expect(new URLSearchParams(navigations[0]).get('brand')).toBeNull();
  });

  it('Load navigation search string equals buildSearchString(currentBrand, currentTemplate)', () => {
    renderNavBar({ currentTemplate: 'dashboard', currentBrand: 'fixture:notion' });
    clickLoad();
    expect(navigations[0]).toBe(buildSearchString('fixture:notion', 'dashboard'));
  });

  it('Load navigation search string is round-trip parseable by parseRoute', () => {
    renderNavBar({ currentTemplate: 'docs', currentBrand: 'fixture:vercel' });
    clickLoad();
    const route = parseRoute(navigations[0]!);
    expect(route.templateId).toBe('docs');
    expect(route.brandParams).toEqual({ type: 'fixture', handle: 'vercel' });
  });
});

describe('NavBar: Enter key in brand input triggers navigation', () => {
  it('pressing Enter causes exactly one navigation call', () => {
    renderNavBar({ currentTemplate: 'landing', currentBrand: 'fixture:stripe' });
    pressEnterInBrandInput();
    expect(navigations).toHaveLength(1);
  });

  it('Enter navigation search string equals buildSearchString(currentBrand, currentTemplate)', () => {
    renderNavBar({ currentTemplate: 'docs', currentBrand: 'fixture:vercel' });
    pressEnterInBrandInput();
    expect(navigations[0]).toBe(buildSearchString('fixture:vercel', 'docs'));
  });

  it.each(ALL_TEMPLATE_IDS)(
    'Enter with currentTemplate="%s" carries app=%s',
    (id) => {
      renderNavBar({ currentTemplate: id, currentBrand: 'fixture:stripe' });
      pressEnterInBrandInput();
      expect(new URLSearchParams(navigations[0]).get('app')).toBe(id);
    },
  );
});

describe('NavBar: brand input initializes from currentBrand prop', () => {
  it.each(FIXTURE_BRANDS)(
    'currentBrand="%s": input.value matches the prop on mount',
    (brand) => {
      renderNavBar({ currentBrand: brand });
      expect(brandInput().value).toBe(brand);
    },
  );

  it('empty currentBrand prop renders an empty input', () => {
    renderNavBar({ currentBrand: '' });
    expect(brandInput().value).toBe('');
  });

  it.each([
    'github:stripe/stripe-js',
    'npm:@booga/vbrand',
    'https://stripe.com',
    `json:${btoa(JSON.stringify({ name: 'acme' }))}`,
  ] as const)(
    'non-fixture brand string "%s" is preserved verbatim in the input',
    (brand) => {
      renderNavBar({ currentBrand: brand });
      expect(brandInput().value).toBe(brand);
    },
  );
});

describe('NavBar: example preset buttons trigger navigation on click', () => {
  it('clicking an example button triggers navigation with the fixture brand value', () => {
    renderNavBar();
    const buttons = exampleButtons();
    expect(buttons.length).toBeGreaterThan(0);
    act(() => buttons[0]!.click());
    expect(navigations).toHaveLength(1);
    expect(navigations[0]).toContain('brand=fixture');
  });

  it('clicking an example button applies the fixture value as the brand param', () => {
    renderNavBar();
    act(() => exampleButtons()[0]!.click());
    expect(navigations[0]).toContain('brand=fixture%3Astripe');
  });

  it('each fixture button triggers exactly one navigation when clicked', () => {
    renderNavBar();
    const buttons = exampleButtons();
    for (let i = 0; i < buttons.length; i++) {
      act(() => buttons[i]!.click());
      expect(navigations).toHaveLength(i + 1);
    }
  });
});

describe('NavBar: Load button disabled state', () => {
  it('is disabled when isLoading is true', () => {
    renderNavBar({ isLoading: true });
    expect(loadButton().disabled).toBe(true);
  });

  it('is enabled when isLoading is false', () => {
    renderNavBar({ isLoading: false });
    expect(loadButton().disabled).toBe(false);
  });

  it('shows "Loading..." text when isLoading is true', () => {
    renderNavBar({ isLoading: true });
    expect(loadButton().textContent?.trim()).toBe('Loading...');
  });

  it('shows "Load" text when isLoading is false', () => {
    renderNavBar({ isLoading: false });
    expect(loadButton().textContent?.trim()).toBe('Load');
  });
});

describe('NavBar: data view link', () => {
  it('href attribute matches the dataViewHref prop', () => {
    renderNavBar({ dataViewHref: '/vBrand/data?brand=fixture:stripe' });
    expect(dataViewLink().getAttribute('href')).toBe('/vBrand/data?brand=fixture:stripe');
  });

  it('click calls onDataViewNavigate exactly once', () => {
    const handler = vi.fn();
    renderNavBar({ onDataViewNavigate: handler });
    act(() => dataViewLink().click());
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('click does not assign to window.location.search', () => {
    renderNavBar({ onDataViewNavigate: vi.fn() });
    act(() => dataViewLink().click());
    expect(navigations).toHaveLength(0);
  });
});

const ALL_MODES: readonly InteractivityMode[] = ['static', 'hybrid', 'spa'];

function modeSelect(): HTMLSelectElement {
  return container.querySelectorAll('select')[1] as HTMLSelectElement;
}

function changeModeSelect(mode: InteractivityMode): void {
  act(() => {
    const sel = modeSelect();
    sel.value = mode;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

describe('NavBar: mode select reflects currentMode prop', () => {
  it.each(ALL_MODES)(
    'currentMode="%s": mode select value matches the prop',
    (mode) => {
      renderNavBar({ currentMode: mode });
      expect(modeSelect().value).toBe(mode);
    },
  );

  it(`defaults to DEFAULT_MODE ("${DEFAULT_MODE}") when currentMode is not provided`, () => {
    renderNavBar({});
    expect(modeSelect().value).toBe(DEFAULT_MODE);
  });

  it('mode select offers exactly three options: static, hybrid, spa', () => {
    renderNavBar();
    const offered = [...modeSelect().options].map((o) => o.value).sort();
    expect(offered).toEqual(['hybrid', 'spa', 'static']);
  });

  it('mode select is a distinct element from the template select', () => {
    renderNavBar();
    expect(modeSelect()).not.toBe(templateSelect());
  });
});

describe('NavBar: mode select change triggers navigation', () => {
  it('changing mode to static causes exactly one navigation call', () => {
    renderNavBar({ currentMode: 'spa' });
    changeModeSelect('static');
    expect(navigations).toHaveLength(1);
  });

  it.each(['static', 'hybrid'] as const)(
    'navigation from mode change to "%s" includes mode=%s in the search string',
    (mode) => {
      renderNavBar({ currentMode: 'spa' });
      changeModeSelect(mode);
      expect(new URLSearchParams(navigations[0]).get('mode')).toBe(mode);
    },
  );

  it('navigation from mode change to spa omits the mode param (DEFAULT_MODE produces clean URL)', () => {
    renderNavBar({ currentMode: 'static' });
    changeModeSelect('spa');
    expect(new URLSearchParams(navigations[0]).get('mode')).toBeNull();
  });

  it('navigation from mode change carries the current brand and template', () => {
    renderNavBar({ currentBrand: 'fixture:vercel', currentTemplate: 'docs', currentMode: 'spa' });
    changeModeSelect('static');
    const params = new URLSearchParams(navigations[0]);
    expect(params.get('brand')).toBe('fixture:vercel');
    expect(params.get('app')).toBe('docs');
    expect(params.get('mode')).toBe('static');
  });

  it('navigation search string equals buildSearchString(brand, template, newMode)', () => {
    renderNavBar({ currentBrand: 'fixture:linear', currentTemplate: 'marketing', currentMode: 'spa' });
    changeModeSelect('hybrid');
    expect(navigations[0]).toBe(buildSearchString('fixture:linear', 'marketing', 'hybrid'));
  });

  it('navigation is round-trip parseable and recovers mode, brand, and template', () => {
    renderNavBar({ currentBrand: 'fixture:stripe', currentTemplate: 'dashboard', currentMode: 'spa' });
    changeModeSelect('static');
    const route = parseRoute(navigations[0]!);
    expect(route.mode).toBe('static');
    expect(route.templateId).toBe('dashboard');
    expect(route.brandParams).toEqual({ type: 'fixture', handle: 'stripe' });
  });
});

describe('NavBar: navigation from brand/template/load preserves active mode', () => {
  it('template change preserves currentMode=static in navigation', () => {
    renderNavBar({ currentBrand: 'fixture:stripe', currentTemplate: 'landing', currentMode: 'static' });
    changeTemplateSelect('docs');
    expect(new URLSearchParams(navigations[0]).get('mode')).toBe('static');
  });

  it('template change with mode=spa (DEFAULT_MODE) omits the mode param', () => {
    renderNavBar({ currentBrand: 'fixture:stripe', currentTemplate: 'landing', currentMode: 'spa' });
    changeTemplateSelect('marketing');
    expect(new URLSearchParams(navigations[0]).get('mode')).toBeNull();
  });

  it('Load button preserves currentMode=hybrid in navigation', () => {
    renderNavBar({ currentBrand: 'fixture:stripe', currentTemplate: 'landing', currentMode: 'hybrid' });
    clickLoad();
    expect(new URLSearchParams(navigations[0]).get('mode')).toBe('hybrid');
  });

  it('Enter key preserves currentMode=static in navigation', () => {
    renderNavBar({ currentBrand: 'fixture:stripe', currentTemplate: 'landing', currentMode: 'static' });
    pressEnterInBrandInput();
    expect(new URLSearchParams(navigations[0]).get('mode')).toBe('static');
  });

  it('Load navigation equals buildSearchString(brand, template, mode)', () => {
    renderNavBar({ currentBrand: 'fixture:notion', currentTemplate: 'dashboard', currentMode: 'static' });
    clickLoad();
    expect(navigations[0]).toBe(buildSearchString('fixture:notion', 'dashboard', 'static'));
  });

  it.each(ALL_MODES)(
    'Load button with mode="%s" round-trips through parseRoute correctly',
    (mode) => {
      renderNavBar({ currentBrand: 'fixture:stripe', currentTemplate: 'marketing', currentMode: mode });
      clickLoad();
      expect(parseRoute(navigations[0]!).mode).toBe(mode);
    },
  );
});

const CROSS_TEMPLATE_PAIRS: ReadonlyArray<[TemplateId, TemplateId]> = [
  ['landing',   'docs'],
  ['landing',   'marketing'],
  ['landing',   'dashboard'],
  ['marketing', 'landing'],
  ['docs',      'dashboard'],
  ['dashboard', 'marketing'],
];

describe('NavBar: navigation hash policy', () => {
  it.each(CROSS_TEMPLATE_PAIRS)(
    'switching template from "%s" to "%s" produces a destination URL with no hash fragment',
    (from, to) => {
      renderNavBar({ currentTemplate: from });
      changeTemplateSelect(to);
      expect(hrefNavigations).toHaveLength(1);
      expect(new URL(hrefNavigations[0]!, 'http://localhost').hash).toBe('');
    },
  );

  it.each(ALL_TEMPLATE_IDS)(
    'selecting the currently active template "%s" does not produce a hash-stripping navigation',
    (id) => {
      renderNavBar({ currentTemplate: id });
      changeTemplateSelect(id);
      expect(hrefNavigations).toHaveLength(0);
      expect(navigations).toHaveLength(1);
    },
  );

  it.each(ALL_MODES)(
    'mode change to "%s" does not produce a hash-stripping navigation',
    (newMode) => {
      const currentMode = newMode === 'spa' ? 'static' : 'spa';
      renderNavBar({ currentTemplate: 'landing', currentMode });
      changeModeSelect(newMode);
      expect(hrefNavigations).toHaveLength(0);
      expect(navigations).toHaveLength(1);
    },
  );

  it('Load button does not produce a hash-stripping navigation', () => {
    renderNavBar({ currentTemplate: 'landing' });
    clickLoad();
    expect(hrefNavigations).toHaveLength(0);
    expect(navigations).toHaveLength(1);
  });

  it('Enter key in brand input does not produce a hash-stripping navigation', () => {
    renderNavBar({ currentTemplate: 'landing' });
    pressEnterInBrandInput();
    expect(hrefNavigations).toHaveLength(0);
    expect(navigations).toHaveLength(1);
  });
});

const BRAND_EXAMPLE_VALUES = [
  'fixture:stripe',
  'fixture:vercel',
  'fixture:linear',
  'fixture:notion',
  'fixture:github',
  'github:bvasilenko/vBrand',
  'npm:@booga/vbrand',
] as const;

function detailsElement(): HTMLDetailsElement {
  return container.querySelector('details') as HTMLDetailsElement;
}

function brandInputDatalist(): HTMLDataListElement | null {
  const inp = brandInput();
  const listId = inp.getAttribute('list');
  return listId ? (container.ownerDocument.getElementById(listId) as HTMLDataListElement | null) : null;
}

function simulateBrandInputChange(value: string): void {
  act(() => {
    const inp = brandInput();
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    )!.set!;
    nativeSetter.call(inp, value);
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('NavBar: brand input datalist element', () => {
  it('brand input has a list attribute referencing a datalist', () => {
    renderNavBar();
    expect(brandInput().getAttribute('list')).toBeTruthy();
    expect(brandInputDatalist()).not.toBeNull();
  });

  it('datalist is a <datalist> element', () => {
    renderNavBar();
    expect(brandInputDatalist()!.tagName.toLowerCase()).toBe('datalist');
  });

  it('datalist contains one option per BRAND_EXAMPLES entry', () => {
    renderNavBar();
    const datalist = brandInputDatalist()!;
    expect(datalist.options.length).toBe(BRAND_EXAMPLE_VALUES.length);
  });

  it.each(BRAND_EXAMPLE_VALUES)(
    'datalist includes an option with value "%s"',
    (value) => {
      renderNavBar();
      const options = [...brandInputDatalist()!.options].map((o) => o.value);
      expect(options).toContain(value);
    },
  );

  it('every datalist option value is a non-empty string', () => {
    renderNavBar();
    const options = [...brandInputDatalist()!.options];
    for (const opt of options) {
      expect(opt.value.length).toBeGreaterThan(0);
    }
  });

  it('datalist option values are unique (no duplicates)', () => {
    renderNavBar();
    const values = [...brandInputDatalist()!.options].map((o) => o.value);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('NavBar: brand input change auto-submits on known example values', () => {
  it('changing input to a known example value triggers exactly one navigation', () => {
    renderNavBar({ currentBrand: '' });
    simulateBrandInputChange('fixture:stripe');
    expect(navigations).toHaveLength(1);
  });

  it.each(BRAND_EXAMPLE_VALUES)(
    'changing to "%s" triggers navigation with that brand value',
    (value) => {
      renderNavBar({ currentBrand: '' });
      simulateBrandInputChange(value);
      expect(navigations).toHaveLength(1);
      expect(new URLSearchParams(navigations[0]).get('brand')).toBe(value);
    },
  );

  it('auto-submit navigation preserves the current template', () => {
    renderNavBar({ currentTemplate: 'docs' });
    simulateBrandInputChange('fixture:linear');
    expect(new URLSearchParams(navigations[0]).get('app')).toBe('docs');
  });

  it('auto-submit navigation preserves the current mode', () => {
    renderNavBar({ currentMode: 'static' });
    simulateBrandInputChange('fixture:vercel');
    expect(new URLSearchParams(navigations[0]).get('mode')).toBe('static');
  });

  it('changing to a partial value that is a prefix of a known example does NOT trigger navigation', () => {
    renderNavBar();
    simulateBrandInputChange('fixture:str');
    expect(navigations).toHaveLength(0);
  });

  it('changing to an unknown brand string does NOT trigger navigation', () => {
    renderNavBar();
    simulateBrandInputChange('github:some/unknown-repo');
    expect(navigations).toHaveLength(0);
  });

  it('changing to an empty string does NOT trigger navigation', () => {
    renderNavBar();
    simulateBrandInputChange('');
    expect(navigations).toHaveLength(0);
  });

  it('successive changes to non-example values produce no navigations', () => {
    renderNavBar();
    simulateBrandInputChange('https://partial');
    simulateBrandInputChange('https://partial.com');
    simulateBrandInputChange('npm:@some/pkg');
    expect(navigations).toHaveLength(0);
  });

  it('auto-submit navigation search string equals buildSearchString for the selected example', () => {
    renderNavBar({ currentTemplate: 'marketing', currentMode: 'hybrid' });
    simulateBrandInputChange('fixture:notion');
    expect(navigations[0]).toBe(buildSearchString('fixture:notion', 'marketing', 'hybrid'));
  });

  it('auto-submit navigation is round-trip parseable by parseRoute', () => {
    renderNavBar({ currentTemplate: 'dashboard' });
    simulateBrandInputChange('fixture:github');
    const route = parseRoute(navigations[0]!);
    expect(route.brandParams).toEqual({ type: 'fixture', handle: 'github' });
    expect(route.templateId).toBe('dashboard');
  });
});

describe('NavBar: examples details keyboard navigation', () => {
  it('pressing Escape on the details element sets open to false', () => {
    renderNavBar();
    const det = detailsElement();
    act(() => { det.open = true; });
    act(() => {
      det.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(det.open).toBe(false);
  });

  it('pressing Escape on a child button closes the details panel (event bubbles)', () => {
    renderNavBar();
    const det = detailsElement();
    act(() => { det.open = true; });
    act(() => {
      const btn = exampleButtons()[0]!;
      btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(det.open).toBe(false);
  });

  it('pressing Tab does NOT close the details panel', () => {
    renderNavBar();
    const det = detailsElement();
    act(() => { det.open = true; });
    act(() => {
      det.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    });
    expect(det.open).toBe(true);
  });

  it('pressing Enter does NOT close the details panel', () => {
    renderNavBar();
    const det = detailsElement();
    act(() => { det.open = true; });
    act(() => {
      det.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    expect(det.open).toBe(true);
  });

  it('Escape on a closed details panel leaves it closed without error', () => {
    renderNavBar();
    const det = detailsElement();
    expect(det.open).toBe(false);
    expect(() => act(() => {
      det.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    })).not.toThrow();
    expect(det.open).toBe(false);
  });

  it('panel can be re-opened after an Escape close', () => {
    renderNavBar();
    const det = detailsElement();
    act(() => { det.open = true; });
    act(() => {
      det.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(det.open).toBe(false);
    act(() => { det.open = true; });
    expect(det.open).toBe(true);
  });

  it('clicking a fixture button closes the details panel', () => {
    renderNavBar();
    const det = detailsElement();
    act(() => { det.open = true; });
    act(() => exampleButtons()[0]!.click());
    expect(det.open).toBe(false);
  });
});
