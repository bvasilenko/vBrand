// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { NavBar } from '../src/nav-bar.js';
import { buildSearchString, parseRoute, type TemplateId } from '../src/router.js';

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

beforeEach(() => {
  navigations = [];
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  vi.stubGlobal('location', {
    search: '',
    pathname: '/',
    hash: '',
    set search(val: string) { navigations.push(val); },
    get search() { return navigations[navigations.length - 1] ?? ''; },
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

interface NavBarOverrides {
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

describe('NavBar: example preset buttons load into brand input without navigating', () => {
  it('clicking an example button does not trigger navigation', () => {
    renderNavBar();
    const buttons = exampleButtons();
    expect(buttons.length).toBeGreaterThan(0);
    act(() => buttons[0]!.click());
    expect(navigations).toHaveLength(0);
  });

  it('clicking an example button populates the brand input with a non-empty value', () => {
    renderNavBar();
    act(() => exampleButtons()[0]!.click());
    expect(brandInput().value.length).toBeGreaterThan(0);
  });

  it('clicking multiple example buttons does not produce navigation', () => {
    renderNavBar();
    const buttons = exampleButtons();
    for (const btn of buttons) act(() => btn.click());
    expect(navigations).toHaveLength(0);
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
