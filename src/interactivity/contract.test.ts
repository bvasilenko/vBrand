// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { describe, it, expect } from 'vitest';
import React from 'react';
import { InteractivityModeSchema, DEFAULT_MODE, parseMode } from './mode.js';
import { markIsland, collectIslands } from './islands.js';
import { staticRender, hybridRender, spaRender } from './render-shapes.js';

const tree = (): React.ReactElement =>
  React.createElement('div', { id: 'root' },
    React.createElement('h1', null, 'Hello'),
    React.createElement('p', null, 'World'),
  );

const treeWithIslands = (): React.ReactElement =>
  React.createElement('div', null,
    markIsland(React.createElement('h1', null, 'Island A'), 'header'),
    React.createElement('p', null, 'Static text'),
    markIsland(React.createElement('footer', null, 'Island B'), 'footer'),
  );

describe('InteractivityMode schema and parsing', () => {
  it('schema accepts static, hybrid, spa', () => {
    expect(InteractivityModeSchema.safeParse('static').success).toBe(true);
    expect(InteractivityModeSchema.safeParse('hybrid').success).toBe(true);
    expect(InteractivityModeSchema.safeParse('spa').success).toBe(true);
  });

  it('schema rejects any other string', () => {
    expect(InteractivityModeSchema.safeParse('ssr').success).toBe(false);
    expect(InteractivityModeSchema.safeParse('').success).toBe(false);
    expect(InteractivityModeSchema.safeParse(null).success).toBe(false);
  });

  it('DEFAULT_MODE is spa', () => {
    expect(DEFAULT_MODE).toBe('spa');
  });

  it('parseMode returns the mode when valid', () => {
    expect(parseMode('static')).toBe('static');
    expect(parseMode('hybrid')).toBe('hybrid');
    expect(parseMode('spa')).toBe('spa');
  });

  it('parseMode returns DEFAULT_MODE for unknown inputs', () => {
    expect(parseMode('ssr')).toBe(DEFAULT_MODE);
    expect(parseMode('')).toBe(DEFAULT_MODE);
    expect(parseMode(null)).toBe(DEFAULT_MODE);
    expect(parseMode(undefined)).toBe(DEFAULT_MODE);
  });
});

describe('staticRender', () => {
  it('produces a non-empty HTML string', () => {
    expect(staticRender(tree()).length).toBeGreaterThan(0);
  });

  it('output contains zero <script> tags', () => {
    const html = staticRender(tree());
    expect(html).not.toContain('<script');
    expect(html).not.toContain('</script>');
  });

  it('output contains zero data-react* attributes', () => {
    const html = staticRender(tree());
    expect(html).not.toMatch(/data-react/);
  });

  it('output preserves text content from the tree', () => {
    const html = staticRender(tree());
    expect(html).toContain('Hello');
    expect(html).toContain('World');
  });

  it('two calls with the same tree produce the same output', () => {
    expect(staticRender(tree())).toBe(staticRender(tree()));
  });
});

describe('hybridRender', () => {
  it('returns an object with html and islands fields', () => {
    const result = hybridRender(tree());
    expect(typeof result.html).toBe('string');
    expect(Array.isArray(result.islands)).toBe(true);
  });

  it('html field matches staticRender output for a tree with no islands', () => {
    expect(hybridRender(tree()).html).toBe(staticRender(tree()));
  });

  it('islands array is empty for a tree with no data-island nodes', () => {
    expect(hybridRender(tree()).islands).toHaveLength(0);
  });

  it('islands array has one entry per distinct data-island id', () => {
    const result = hybridRender(treeWithIslands());
    expect(result.islands).toHaveLength(2);
  });

  it('island ids match the markIsland ids in order', () => {
    const result = hybridRender(treeWithIslands());
    expect(result.islands[0]!.id).toBe('header');
    expect(result.islands[1]!.id).toBe('footer');
  });

  it('island selectors are css attribute selectors for data-island', () => {
    const result = hybridRender(treeWithIslands());
    for (const island of result.islands) {
      expect(island.selector).toMatch(/^\[data-island="/);
    }
  });

  it('html contains the data-island attributes matching the manifest', () => {
    const result = hybridRender(treeWithIslands());
    for (const island of result.islands) {
      expect(result.html).toContain(`data-island="${island.id}"`);
    }
  });

  it('static text outside islands is present in the html', () => {
    const result = hybridRender(treeWithIslands());
    expect(result.html).toContain('Static text');
  });

  it('html field contains zero <script> tags', () => {
    const html = hybridRender(treeWithIslands()).html;
    expect(html).not.toContain('<script');
    expect(html).not.toContain('</script>');
  });

  it('html field contains no data-react* attributes', () => {
    expect(hybridRender(treeWithIslands()).html).not.toMatch(/data-react/);
  });
});

describe('spaRender', () => {
  it('returns the tree referentially unchanged', () => {
    const t = tree();
    expect(spaRender(t)).toBe(t);
  });
});

describe('markIsland', () => {
  it('wraps the node in a div with data-island attribute', () => {
    const html = staticRender(markIsland(React.createElement('span', null, 'hi'), 'test-id'));
    expect(html).toContain('data-island="test-id"');
    expect(html).toContain('hi');
  });
});

describe('collectIslands', () => {
  it('returns empty array for html with no data-island attributes', () => {
    expect(collectIslands('<div><p>hello</p></div>')).toHaveLength(0);
  });

  it('returns one entry per distinct data-island id', () => {
    const html = '<div data-island="a"><div data-island="b"></div></div>';
    expect(collectIslands(html)).toHaveLength(2);
  });

  it('deduplicates repeated data-island ids', () => {
    const html = '<div data-island="x"></div><div data-island="x"></div>';
    expect(collectIslands(html)).toHaveLength(1);
  });

  it('each entry has id matching the attribute value', () => {
    const result = collectIslands('<div data-island="nav"></div>');
    expect(result[0]!.id).toBe('nav');
  });

  it('each entry selector wraps the id as a data-island attribute selector', () => {
    const result = collectIslands('<div data-island="hero"></div>');
    expect(result[0]!.selector).toBe('[data-island="hero"]');
  });
});
