// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { describe, it, expect } from 'vitest';
import React from 'react';
import { InteractivityModeSchema, DEFAULT_MODE, parseMode } from './mode.js';
import { markIsland, collectIslands, withIslandCapture, buildIslandRegistry } from './islands.js';
import { renderToStaticMarkup } from 'react-dom/server';
import { staticRender, hybridRender, spaRender, renderBodyFragment } from './render-shapes.js';
import type { VbrandType } from '../schema.js';

const EMPTY_BRAND: VbrandType = {
  name: 'Test',
  sources: [],
  voice: { canonical: '', repoDescription: '' },
  assets: { favicon: { source: 'x', sizes: [32] }, og: { dimensions: [1200, 630] }, icons: { source: 'x', set: [] } },
  tokens: { color: {}, type: {} },
};


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
  it('produces a full HTML document string', () => {
    const html = staticRender({ brand: EMPTY_BRAND, sections: [tree()] });
    expect(html).toMatch(/^<!doctype html>/i);
    expect(html).toContain('</html>');
  });

  it('output contains no executable script tags', () => {
    const html = staticRender({ brand: EMPTY_BRAND, sections: [tree()] });
    expect(html).not.toMatch(/<script(?![^>]*type="application\/json")/);
  });

  it('output contains zero data-react* attributes', () => {
    const html = staticRender({ brand: EMPTY_BRAND, sections: [tree()] });
    expect(html).not.toMatch(/data-react/);
  });

  it('output preserves text content from the sections', () => {
    const html = staticRender({ brand: EMPTY_BRAND, sections: [tree()] });
    expect(html).toContain('Hello');
    expect(html).toContain('World');
  });

  it('two calls with the same props produce the same output', () => {
    const p = { brand: EMPTY_BRAND, sections: [tree()] };
    expect(staticRender(p)).toBe(staticRender(p));
  });

  it('output contains inline styles (themed render plumbing is wired)', () => {
    const html = staticRender({ brand: EMPTY_BRAND, sections: [tree()] });
    expect(html).toContain('<style>');
  });
});

describe('hybridRender', () => {
  it('returns an object with html and islands fields', () => {
    const result = hybridRender({ brand: EMPTY_BRAND, sections: [tree()] });
    expect(typeof result.html).toBe('string');
    expect(Array.isArray(result.islands)).toBe(true);
  });

  it('html is a full HTML document', () => {
    const result = hybridRender({ brand: EMPTY_BRAND, sections: [tree()] });
    expect(result.html).toMatch(/^<!doctype html>/i);
    expect(result.html).toContain('</html>');
  });

  it('html contains islands manifest JSON script in head', () => {
    const result = hybridRender({ brand: EMPTY_BRAND, sections: [tree()] });
    expect(result.html).toContain('<script type="application/json" id="__VBRAND_ISLANDS__">');
  });

  it('islands array is empty for a tree with no data-island nodes', () => {
    expect(hybridRender({ brand: EMPTY_BRAND, sections: [tree()] }).islands).toHaveLength(0);
  });

  it('islands array has one entry per distinct data-island id', () => {
    const result = hybridRender({ brand: EMPTY_BRAND, sections: [treeWithIslands()] });
    expect(result.islands).toHaveLength(2);
  });

  it('island ids match the markIsland ids in order', () => {
    const result = hybridRender({ brand: EMPTY_BRAND, sections: [treeWithIslands()] });
    expect(result.islands[0]!.id).toBe('header');
    expect(result.islands[1]!.id).toBe('footer');
  });

  it('island selectors are css attribute selectors for data-island', () => {
    const result = hybridRender({ brand: EMPTY_BRAND, sections: [treeWithIslands()] });
    for (const island of result.islands) {
      expect(island.selector).toMatch(/^\[data-island="/);
    }
  });

  it('html contains the data-island attributes matching the manifest', () => {
    const result = hybridRender({ brand: EMPTY_BRAND, sections: [treeWithIslands()] });
    for (const island of result.islands) {
      expect(result.html).toContain(`data-island="${island.id}"`);
    }
  });

  it('static text outside islands is present in the html', () => {
    const result = hybridRender({ brand: EMPTY_BRAND, sections: [treeWithIslands()] });
    expect(result.html).toContain('Static text');
  });

  it('html contains no executable script tags outside the JSON manifest', () => {
    const html = hybridRender({ brand: EMPTY_BRAND, sections: [treeWithIslands()] }).html;
    expect(html).not.toMatch(/<script(?![^>]*type="application\/json")/);
  });

  it('html field contains no data-react* attributes', () => {
    expect(hybridRender({ brand: EMPTY_BRAND, sections: [treeWithIslands()] }).html).not.toMatch(/data-react/);
  });

  it('result contains a getIslandComponent accessor function', () => {
    expect(typeof hybridRender({ brand: EMPTY_BRAND, sections: [tree()] }).getIslandComponent).toBe('function');
  });

  it('getIslandComponent returns null for any id absent from the island manifest', () => {
    const result = hybridRender({ brand: EMPTY_BRAND, sections: [treeWithIslands()] });
    expect(result.getIslandComponent('not-in-manifest')).toBeNull();
  });

  it('result contains a registry object mapping island ids to nodes', () => {
    const result = hybridRender({ brand: EMPTY_BRAND, sections: [treeWithIslands()] });
    expect(typeof result.registry).toBe('object');
    expect('header' in result.registry).toBe(true);
    expect('footer' in result.registry).toBe(true);
  });

  it('two sequential calls produce independent island manifests and do not share registry state', () => {
    const withOne = React.createElement('div', null,
      markIsland(React.createElement('span', null, 'A'), 'seq-only'),
    );
    const withTwo = React.createElement('div', null,
      markIsland(React.createElement('span', null, 'B'), 'seq-first'),
      markIsland(React.createElement('span', null, 'C'), 'seq-second'),
    );
    const r1 = hybridRender({ brand: EMPTY_BRAND, sections: [withOne] });
    const r2 = hybridRender({ brand: EMPTY_BRAND, sections: [withTwo] });
    expect(r1.islands).toHaveLength(1);
    expect(r1.islands[0]!.id).toBe('seq-only');
    expect(r2.islands).toHaveLength(2);
    expect(r2.getIslandComponent('seq-only')).toBeNull();
    expect(r1.getIslandComponent('seq-first')).toBeNull();
  });
});

describe('spaRender', () => {
  it('returns the tree referentially unchanged', () => {
    const t = tree();
    expect(spaRender(t)).toBe(t);
  });
});

describe('renderBodyFragment', () => {
  it('returns body-only HTML without doctype or head', () => {
    const html = renderBodyFragment([tree()]);
    expect(html).not.toContain('<!doctype');
    expect(html).not.toContain('<html');
    expect(html).toContain('Hello');
  });
});

describe('markIsland', () => {
  it('wraps the node in a div with data-island attribute', () => {
    const html = staticRender({ brand: EMPTY_BRAND, sections: [markIsland(React.createElement('span', null, 'hi'), 'test-id')] });
    expect(html).toContain('data-island="test-id"');
    expect(html).toContain('hi');
  });

  it('data-island attribute value equals the exact id string passed', () => {
    const html = staticRender({ brand: EMPTY_BRAND, sections: [markIsland(React.createElement('span', null, 'x'), 'exact-id-42')] });
    expect(html).toContain('data-island="exact-id-42"');
    expect(html).not.toContain('data-island="exact-id-4"');
  });

  it('child content is preserved inside the wrapper element', () => {
    const inner = React.createElement('section', null, React.createElement('em', null, 'nested'));
    const html = staticRender({ brand: EMPTY_BRAND, sections: [markIsland(inner, 'nest')] });
    expect(html).toContain('<em>nested</em>');
  });

  it('accepts null as a valid React.ReactNode child without throwing', () => {
    expect(() => markIsland(null, 'null-child')).not.toThrow();
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

  it('captures ids containing dots, hyphens, and digits without truncation', () => {
    const html = '<div data-island="landing.hero-1"></div>';
    expect(collectIslands(html)[0]!.id).toBe('landing.hero-1');
  });

  it('does not match similarly-named attributes (data-islands, data-island-id)', () => {
    const html = '<div data-islands="a" data-island-id="b" data-my-island="c"></div>';
    expect(collectIslands(html)).toHaveLength(0);
  });

  it('returns empty array for an empty string input', () => {
    expect(collectIslands('')).toHaveLength(0);
  });

  it('returns empty array for whitespace-only input', () => {
    expect(collectIslands('   ')).toHaveLength(0);
  });

  it('does not collect a data-island attribute whose value is an empty string', () => {
    expect(collectIslands('<div data-island=""></div>')).toHaveLength(0);
  });
});

describe('withIslandCapture + markIsland registry', () => {
  it('captures exactly the nodes passed to markIsland during the fn call', () => {
    const nodeA = React.createElement('span', null, 'A');
    const nodeB = React.createElement('span', null, 'B');
    const { getIslandComponent } = withIslandCapture(() => {
      markIsland(nodeA, 'island-a');
      markIsland(nodeB, 'island-b');
    });
    expect(getIslandComponent('island-a')).toBe(nodeA);
    expect(getIslandComponent('island-b')).toBe(nodeB);
  });

  it('registry field mirrors getIslandComponent results', () => {
    const nodeA = React.createElement('span', null, 'A');
    const { registry, getIslandComponent } = withIslandCapture(() => {
      markIsland(nodeA, 'r-a');
    });
    expect(registry['r-a']).toBe(getIslandComponent('r-a'));
  });

  it('returns null for an id that was not marked during the fn call', () => {
    const { getIslandComponent } = withIslandCapture(() => {
      markIsland(React.createElement('div', null), 'present');
    });
    expect(getIslandComponent('absent')).toBeNull();
  });

  it('resets the capture registry after fn completes so subsequent markIsland calls are not captured', () => {
    withIslandCapture(() => markIsland(React.createElement('div', null), 'inside'));
    const outsideNode = React.createElement('span', null, 'outside');
    markIsland(outsideNode, 'outside');
    const { getIslandComponent } = withIslandCapture(() => {});
    expect(getIslandComponent('outside')).toBeNull();
  });

  it('hybridRender result getIslandComponent returns the node for each marked island id', () => {
    const nodeA = React.createElement('h1', null, 'Island A');
    const nodeB = React.createElement('footer', null, 'Island B');
    const t = React.createElement('div', null,
      markIsland(nodeA, 'header'),
      React.createElement('p', null, 'static'),
      markIsland(nodeB, 'footer-island'),
    );
    const { islands, getIslandComponent } = hybridRender({ brand: EMPTY_BRAND, sections: [t] });
    expect(islands).toHaveLength(2);
    expect(getIslandComponent('header')).not.toBeNull();
    expect(getIslandComponent('footer-island')).not.toBeNull();
    expect(getIslandComponent('nonexistent')).toBeNull();
  });

  it('hybridRender island count matches getIslandComponent non-null count for all island ids', () => {
    const treeWithTwo = React.createElement('div', null,
      markIsland(React.createElement('span', null, 'X'), 'id-x'),
      markIsland(React.createElement('span', null, 'Y'), 'id-y'),
    );
    const { islands, getIslandComponent } = hybridRender({ brand: EMPTY_BRAND, sections: [treeWithTwo] });
    const nonNullCount = islands.filter((e) => getIslandComponent(e.id) !== null).length;
    expect(nonNullCount).toBe(islands.length);
  });

  it('populates registry for nodes wrapped before withIslandCapture when the tree is rendered inside fn', () => {
    const node = React.createElement('span', null, 'render-path');
    const markedTree = markIsland(node, 'render-island');
    const { getIslandComponent } = withIslandCapture(() => renderToStaticMarkup(markedTree));
    expect(getIslandComponent('render-island')).toBe(node);
  });

  it('when the same id is registered twice the last registration takes precedence', () => {
    const nodeA = React.createElement('span', null, 'first');
    const nodeB = React.createElement('span', null, 'second');
    const { getIslandComponent } = withIslandCapture(() => {
      markIsland(nodeA, 'dup-id');
      markIsland(nodeB, 'dup-id');
    });
    expect(getIslandComponent('dup-id')).toBe(nodeB);
  });

  it('two sequential withIslandCapture calls have independent isolated registries', () => {
    const node = React.createElement('span', null, 'seq');
    const { getIslandComponent: first } = withIslandCapture(() => { markIsland(node, 'seq-id'); });
    const { getIslandComponent: second } = withIslandCapture(() => {});
    expect(first('seq-id')).toBe(node);
    expect(second('seq-id')).toBeNull();
  });

  it('resets the capture registry to null when fn throws so markIsland calls after the throw are not recorded', () => {
    expect(() => withIslandCapture(() => { throw new Error('deliberate'); })).toThrow('deliberate');
    const orphan = React.createElement('span', null, 'orphan');
    markIsland(orphan, 'post-throw-orphan');
    const { getIslandComponent } = withIslandCapture(() => {});
    expect(getIslandComponent('post-throw-orphan')).toBeNull();
  });
});

describe('buildIslandRegistry', () => {
  it('returns a registry with entries for all markIsland ids in the tree', () => {
    const t = React.createElement('div', null,
      markIsland(React.createElement('span', null, 'A'), 'reg-a'),
      markIsland(React.createElement('span', null, 'B'), 'reg-b'),
    );
    const registry = buildIslandRegistry(t);
    expect('reg-a' in registry).toBe(true);
    expect('reg-b' in registry).toBe(true);
  });

  it('returns an empty registry for a tree with no markIsland calls', () => {
    const t = React.createElement('div', null, React.createElement('span', null, 'plain'));
    const registry = buildIslandRegistry(t);
    expect(Object.keys(registry)).toHaveLength(0);
  });

  it('registry values are the React nodes passed to markIsland', () => {
    const node = React.createElement('span', null, 'target');
    const t = markIsland(node, 'target-id');
    const registry = buildIslandRegistry(t);
    expect(registry['target-id']).toBe(node);
  });
});
