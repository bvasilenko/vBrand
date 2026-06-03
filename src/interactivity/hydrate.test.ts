// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { hydrateIslands, collectIslands, markIsland } from './islands.js';
import { staticRender } from './render-shapes.js';

vi.mock('react-dom/client', () => ({
  hydrateRoot: vi.fn(),
}));

function seedDocument(html: string): void {
  document.body.innerHTML = `<div id="host">${html}</div>`;
}

beforeEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});


describe('hydrateIslands: empty manifest', () => {
  it('resolves without calling document.querySelector', async () => {
    const spy = vi.spyOn(document, 'querySelector');
    await hydrateIslands([], () => React.createElement('span', null, 'x'));
    expect(spy).not.toHaveBeenCalled();
  });

  it('resolves to undefined', async () => {
    await expect(hydrateIslands([], () => React.createElement('span', null, 'x'))).resolves.toBeUndefined();
  });
});


describe('hydrateIslands: single island present in DOM', () => {
  it('calls hydrateRoot exactly once', async () => {
    const { hydrateRoot } = await import('react-dom/client');
    const html = staticRender(markIsland(React.createElement('span', null, 'Solo'), 'solo'));
    seedDocument(html);
    await hydrateIslands(collectIslands(html), () => React.createElement('span', null, 'x'));
    expect(hydrateRoot).toHaveBeenCalledTimes(1);
  });
});

describe('hydrateIslands: multiple islands all present in DOM', () => {
  it('calls hydrateRoot once per manifest entry when all selectors match', async () => {
    const { hydrateRoot } = await import('react-dom/client');
    const tree = React.createElement('div', null,
      markIsland(React.createElement('h1', null, 'Title'), 'hero'),
      markIsland(React.createElement('footer', null, 'Footer'), 'footer'),
    );
    const html = staticRender(tree);
    seedDocument(html);
    const manifest = collectIslands(html);
    expect(manifest).toHaveLength(2);
    await hydrateIslands(manifest, () => React.createElement('span', null, 'x'));
    expect(hydrateRoot).toHaveBeenCalledTimes(2);
  });
});

describe('hydrateIslands: partial match - some entries absent from DOM', () => {
  it('calls hydrateRoot only for entries whose selectors match a DOM element', async () => {
    const { hydrateRoot } = await import('react-dom/client');
    const html = staticRender(markIsland(React.createElement('span', null, 'Present'), 'present'));
    seedDocument(html);
    const manifest = [
      { id: 'present', selector: '[data-island="present"]', propsHash: '' },
      { id: 'absent',  selector: '[data-island="absent"]',  propsHash: '' },
    ];
    await hydrateIslands(manifest, () => React.createElement('span', null, 'x'));
    expect(hydrateRoot).toHaveBeenCalledTimes(1);
  });

  it('calls hydrateRoot zero times when no manifest selector matches the DOM', async () => {
    const { hydrateRoot } = await import('react-dom/client');
    seedDocument('<div>no islands</div>');
    const manifest = [
      { id: 'ghost-a', selector: '[data-island="ghost-a"]', propsHash: '' },
      { id: 'ghost-b', selector: '[data-island="ghost-b"]', propsHash: '' },
    ];
    await hydrateIslands(manifest, () => React.createElement('span', null, 'x'));
    expect(hydrateRoot).not.toHaveBeenCalled();
  });
});


describe('hydrateIslands: component identity passed to hydrateRoot', () => {
  it('passes the ReactNode returned by getComponent as the second argument to hydrateRoot', async () => {
    const { hydrateRoot } = await import('react-dom/client');
    const html = staticRender(markIsland(React.createElement('span', null, 'A'), 'a'));
    seedDocument(html);
    const manifest = collectIslands(html);
    const sentinel = React.createElement('span', { 'data-sentinel': 'identity' }, 'unique');
    await hydrateIslands(manifest, () => sentinel);
    expect(hydrateRoot).toHaveBeenCalledWith(expect.any(Element), sentinel);
  });

  it('passes the correct DOM element (matching the selector) as the first argument to hydrateRoot', async () => {
    const { hydrateRoot } = await import('react-dom/client');
    const html = staticRender(markIsland(React.createElement('span', null, 'A'), 'target'));
    seedDocument(html);
    const manifest = collectIslands(html);
    await hydrateIslands(manifest, () => React.createElement('span', null, 'x'));
    const expectedEl = document.querySelector('[data-island="target"]');
    expect(hydrateRoot).toHaveBeenCalledWith(expectedEl, expect.anything());
  });
});


describe('hydrateIslands: getComponent invocation contract', () => {
  it('getComponent is not called for manifest entries with no matching DOM node', async () => {
    seedDocument('<div>empty</div>');
    const getComponent = vi.fn(() => React.createElement('span', null, 'x'));
    await hydrateIslands([{ id: 'ghost', selector: '[data-island="ghost"]', propsHash: '' }], getComponent);
    expect(getComponent).not.toHaveBeenCalled();
  });

  it('getComponent is not called at all for an empty manifest', async () => {
    const getComponent = vi.fn(() => React.createElement('span', null, 'x'));
    await hydrateIslands([], getComponent);
    expect(getComponent).not.toHaveBeenCalled();
  });

  it('getComponent is called once per matched island', async () => {
    const tree = React.createElement('div', null,
      markIsland(React.createElement('span', null, 'A'), 'a'),
      markIsland(React.createElement('span', null, 'B'), 'b'),
    );
    const html = staticRender(tree);
    seedDocument(html);
    const getComponent = vi.fn(() => React.createElement('span', null, 'x'));
    await hydrateIslands(collectIslands(html), getComponent);
    expect(getComponent).toHaveBeenCalledTimes(2);
  });

  it('getComponent is called with each island id in manifest declaration order', async () => {
    const tree = React.createElement('div', null,
      markIsland(React.createElement('span', null, 'First'), 'first'),
      markIsland(React.createElement('span', null, 'Second'), 'second'),
      markIsland(React.createElement('span', null, 'Third'), 'third'),
    );
    const html = staticRender(tree);
    seedDocument(html);
    const callOrder: string[] = [];
    await hydrateIslands(collectIslands(html), (id) => {
      callOrder.push(id);
      return React.createElement('span', null, id);
    });
    expect(callOrder).toEqual(['first', 'second', 'third']);
  });

  it('getComponent receives the island id string matching the manifest entry', async () => {
    const html = staticRender(markIsland(React.createElement('span', null, 'X'), 'exact-id-123'));
    seedDocument(html);
    const receivedIds: string[] = [];
    await hydrateIslands(collectIslands(html), (id) => {
      receivedIds.push(id);
      return React.createElement('span', null, 'x');
    });
    expect(receivedIds).toEqual(['exact-id-123']);
  });
});


describe('hydrateIslands: custom IslandQueryContext doc parameter', () => {
  it('queries the provided context instead of the global document', async () => {
    const { hydrateRoot } = await import('react-dom/client');
    const el = document.createElement('div');
    el.setAttribute('data-island', 'alt');
    const customDoc = { querySelector: vi.fn((_selector: string) => el) };
    const html = staticRender(markIsland(React.createElement('span', null, 'X'), 'alt'));
    const manifest = collectIslands(html);
    await hydrateIslands(manifest, () => React.createElement('span', null, 'x'), customDoc);
    expect(customDoc.querySelector).toHaveBeenCalledWith('[data-island="alt"]');
    expect(hydrateRoot).toHaveBeenCalledWith(el, expect.anything());
  });

  it('does not touch the global document when a custom context is provided', async () => {
    const globalSpy = vi.spyOn(document, 'querySelector');
    const customDoc = { querySelector: vi.fn(() => null) };
    const html = staticRender(markIsland(React.createElement('span', null, 'X'), 'isolated'));
    const manifest = collectIslands(html);
    await hydrateIslands(manifest, () => React.createElement('span', null, 'x'), customDoc);
    expect(globalSpy).not.toHaveBeenCalled();
  });

  it('falls back to the global document when no context argument is passed', async () => {
    const html = staticRender(markIsland(React.createElement('span', null, 'Default'), 'def-fallback'));
    seedDocument(html);
    const globalSpy = vi.spyOn(document, 'querySelector');
    const manifest = collectIslands(html);
    await hydrateIslands(manifest, () => React.createElement('span', null, 'x'));
    expect(globalSpy).toHaveBeenCalledWith('[data-island="def-fallback"]');
  });

  it('does not call hydrateRoot when the custom context returns null for all selectors', async () => {
    const { hydrateRoot } = await import('react-dom/client');
    const customDoc = { querySelector: vi.fn(() => null) };
    const html = staticRender(markIsland(React.createElement('span', null, 'X'), 'no-match'));
    const manifest = collectIslands(html);
    await hydrateIslands(manifest, () => React.createElement('span', null, 'x'), customDoc);
    expect(hydrateRoot).not.toHaveBeenCalled();
  });

  it('empty manifest: custom context querySelector is never called', async () => {
    const customDoc = { querySelector: vi.fn(() => null) };
    await hydrateIslands([], () => React.createElement('span', null, 'x'), customDoc);
    expect(customDoc.querySelector).not.toHaveBeenCalled();
  });

  it('partial match: hydrateRoot called only for entries where the custom context returns a non-null element', async () => {
    const { hydrateRoot } = await import('react-dom/client');
    const presentEl = document.createElement('div');
    const customDoc = {
      querySelector: vi.fn((selector: string) =>
        selector === '[data-island="present"]' ? presentEl : null,
      ),
    };
    const manifest = [
      { id: 'present', selector: '[data-island="present"]', propsHash: '' },
      { id: 'absent',  selector: '[data-island="absent"]',  propsHash: '' },
    ];
    await hydrateIslands(manifest, () => React.createElement('span', null, 'x'), customDoc);
    expect(hydrateRoot).toHaveBeenCalledTimes(1);
    expect(hydrateRoot).toHaveBeenCalledWith(presentEl, expect.anything());
  });

  it('multiple islands: custom context querySelector is called once per island selector in manifest order', async () => {
    const makeEl = (id: string) => {
      const el = document.createElement('div');
      el.setAttribute('data-island', id);
      return el;
    };
    const elA = makeEl('ctx-a');
    const elB = makeEl('ctx-b');
    const elC = makeEl('ctx-c');
    const elMap: Record<string, Element> = {
      '[data-island="ctx-a"]': elA,
      '[data-island="ctx-b"]': elB,
      '[data-island="ctx-c"]': elC,
    };
    const customDoc = { querySelector: vi.fn((s: string) => elMap[s] ?? null) };
    const tree = React.createElement('div', null,
      markIsland(React.createElement('span', null, 'A'), 'ctx-a'),
      markIsland(React.createElement('span', null, 'B'), 'ctx-b'),
      markIsland(React.createElement('span', null, 'C'), 'ctx-c'),
    );
    const html = staticRender(tree);
    const manifest = collectIslands(html);
    await hydrateIslands(manifest, () => React.createElement('span', null, 'x'), customDoc);
    expect(customDoc.querySelector).toHaveBeenCalledTimes(3);
    expect(customDoc.querySelector).toHaveBeenNthCalledWith(1, '[data-island="ctx-a"]');
    expect(customDoc.querySelector).toHaveBeenNthCalledWith(2, '[data-island="ctx-b"]');
    expect(customDoc.querySelector).toHaveBeenNthCalledWith(3, '[data-island="ctx-c"]');
  });
});
