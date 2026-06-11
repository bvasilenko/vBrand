// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { describe, it, expect, beforeAll } from 'vitest';
import React from 'react';
import { loadFromFixtureHandle } from '../../../src/adapters/brand-source/fixture-loader.js';
import { TEMPLATE_IDS, TEMPLATE_REGISTRY } from '../../../src/templates/registry.js';
import type { TemplateId } from '../../../src/templates/registry.js';
import { staticRender, hybridRender, spaRender } from '../../../src/interactivity/render-shapes.js';
import type { ContentOverrideMap } from '../../../src/content/override.js';

type Brand = Awaited<ReturnType<typeof loadFromFixtureHandle>>;

let brand: Brand;
beforeAll(async () => { brand = await loadFromFixtureHandle('stripe'); });

function getTree(templateId: TemplateId): React.ReactElement {
  const template = TEMPLATE_REGISTRY[templateId];
  return template.compose(brand, template.defaultComposition()) as React.ReactElement;
}

type Mode = 'static' | 'hybrid' | 'spa';
const MODES: readonly Mode[] = ['static', 'hybrid', 'spa'];

const ALL_COMBINATIONS: ReadonlyArray<[TemplateId, Mode]> = TEMPLATE_IDS.flatMap(
  (id) => MODES.map((mode) => [id, mode] as [TemplateId, Mode]),
);

const OVERRIDE_SENTINEL = 'MatrixOverrideSentinel';

const PER_TEMPLATE_OVERRIDE: ReadonlyArray<[TemplateId, ContentOverrideMap]> = [
  ['landing',   { 'landing.hero.heading':      OVERRIDE_SENTINEL }],
  ['marketing', { 'marketing.hero.heading':    OVERRIDE_SENTINEL }],
  ['docs',      { 'docs.sidebar.heading':      OVERRIDE_SENTINEL }],
  ['dashboard', { 'dashboard.sidebar.heading': OVERRIDE_SENTINEL }],
];

const ALL_OVERRIDE_COMBOS: ReadonlyArray<[TemplateId, Mode, ContentOverrideMap]> =
  PER_TEMPLATE_OVERRIDE.flatMap(([id, override]) =>
    MODES.map(mode => [id, mode, override] as [TemplateId, Mode, ContentOverrideMap]),
  );

describe('render mode safety: all template x mode combinations produce output without throwing', () => {
  it.each(ALL_COMBINATIONS)('%s / %s: does not throw', (templateId, mode) => {
    const tree = getTree(templateId);
    const invoke =
      mode === 'static' ? () => staticRender({ brand, sections: [tree] }) :
      mode === 'hybrid' ? () => hybridRender({ brand, sections: [tree] }) :
      () => spaRender(tree);
    expect(invoke).not.toThrow();
  });
});

describe('staticRender: output contract for real template trees', () => {
  it.each([...TEMPLATE_IDS])('%s: output is a non-empty string', (id) => {
    expect(staticRender({ brand, sections: [getTree(id)] }).length).toBeGreaterThan(0);
  });

  it.each([...TEMPLATE_IDS])('%s: output contains no <script> tags', (id) => {
    const html = staticRender({ brand, sections: [getTree(id)] });
    expect(html).not.toContain('<script');
    expect(html).not.toContain('</script>');
  });

  it.each([...TEMPLATE_IDS])('%s: output contains no data-react attributes', (id) => {
    expect(staticRender({ brand, sections: [getTree(id)] })).not.toMatch(/data-react/);
  });

  it.each([...TEMPLATE_IDS])('%s: output contains brand-specific text from the stripe fixture', (id) => {
    expect(staticRender({ brand, sections: [getTree(id)] })).toContain(brand.name);
  });

  it.each([...TEMPLATE_IDS])('%s: two calls with the same default composition produce identical output', (id) => {
    expect(staticRender({ brand, sections: [getTree(id)] })).toBe(staticRender({ brand, sections: [getTree(id)] }));
  });
});

describe('hybridRender: output contract for real template trees', () => {
  it.each([...TEMPLATE_IDS])('%s: html field is the full-document output with manifest script injected before </head>', (id) => {
    const props = { brand, sections: [getTree(id)] };
    const srHtml = staticRender(props);
    const hrResult = hybridRender(props);
    const expectedHtml = srHtml.replace('</head>', `<script type="application/json" id="__VBRAND_ISLANDS__">${JSON.stringify(hrResult.islands)}</script></head>`);
    expect(hrResult.html).toBe(expectedHtml);
  });

  it.each([...TEMPLATE_IDS])('%s: islands field is an array', (id) => {
    expect(Array.isArray(hybridRender({ brand, sections: [getTree(id)] }).islands)).toBe(true);
  });

  it.each([...TEMPLATE_IDS])('%s: every island entry has a non-empty string id', (id) => {
    for (const island of hybridRender({ brand, sections: [getTree(id)] }).islands) {
      expect(typeof island.id).toBe('string');
      expect(island.id.length).toBeGreaterThan(0);
    }
  });

  it.each([...TEMPLATE_IDS])('%s: every island selector follows the [data-island="id"] pattern', (id) => {
    for (const island of hybridRender({ brand, sections: [getTree(id)] }).islands) {
      expect(island.selector).toBe(`[data-island="${island.id}"]`);
    }
  });

  it.each([...TEMPLATE_IDS])('%s: result is JSON-serializable (islands are plain objects)', (id) => {
    expect(() => JSON.stringify(hybridRender({ brand, sections: [getTree(id)] }))).not.toThrow();
  });

  it.each([...TEMPLATE_IDS])('%s: html field contains no executable <script> tags (only JSON manifest)', (id) => {
    const html = hybridRender({ brand, sections: [getTree(id)] }).html;
    expect(html).not.toMatch(/<script(?![^>]*type="application\/json")/);
  });

  it.each([...TEMPLATE_IDS])('%s: html field contains no data-react* attributes', (id) => {
    expect(hybridRender({ brand, sections: [getTree(id)] }).html).not.toMatch(/data-react/);
  });
});

describe('spaRender: passthrough contract for real template trees', () => {
  it.each([...TEMPLATE_IDS])('%s: returns the exact tree reference passed in', (id) => {
    const tree = getTree(id);
    expect(spaRender(tree)).toBe(tree);
  });

  it.each([...TEMPLATE_IDS])('%s: result is a React element with .type and .props', (id) => {
    const result = spaRender(getTree(id)) as React.ReactElement;
    expect(result).not.toBeNull();
    expect(result.type).toBeDefined();
    expect(result.props).toBeDefined();
  });
});

describe('render mode non-interference: render calls do not mutate the source tree', () => {
  it.each([...TEMPLATE_IDS])('%s: staticRender does not mutate the tree (spaRender still returns same ref)', (id) => {
    const tree = getTree(id);
    staticRender({ brand, sections: [tree] });
    expect(spaRender(tree)).toBe(tree);
  });

  it.each([...TEMPLATE_IDS])('%s: hybridRender does not mutate the tree (spaRender still returns same ref)', (id) => {
    const tree = getTree(id);
    hybridRender({ brand, sections: [tree] });
    expect(spaRender(tree)).toBe(tree);
  });

  it.each([...TEMPLATE_IDS])('%s: staticRender output is identical before and after hybridRender is called', (id) => {
    const tree = getTree(id);
    const before = staticRender({ brand, sections: [tree] });
    hybridRender({ brand, sections: [tree] });
    expect(staticRender({ brand, sections: [tree] })).toBe(before);
  });
});

describe('render mode + content override orthogonality: override value is present in all mode outputs', () => {
  it.each(ALL_OVERRIDE_COMBOS)(
    '%s / %s: content override sentinel value appears in rendered output',
    (id, mode, override) => {
      const template = TEMPLATE_REGISTRY[id];
      const tree = template.compose(brand, template.defaultComposition(), override) as React.ReactElement;
      const html =
        mode === 'static' ? staticRender({ brand, sections: [tree] }) :
        mode === 'hybrid' ? hybridRender({ brand, sections: [tree] }).html :
        staticRender({ brand, sections: [spaRender(tree) as React.ReactElement] });
      expect(html).toContain(OVERRIDE_SENTINEL);
    },
  );

  it.each(ALL_OVERRIDE_COMBOS)(
    '%s / %s: render with content override does not throw',
    (id, mode, override) => {
      const template = TEMPLATE_REGISTRY[id];
      const invoke = () => {
        const tree = template.compose(brand, template.defaultComposition(), override) as React.ReactElement;
        if (mode === 'static') staticRender({ brand, sections: [tree] });
        else if (mode === 'hybrid') hybridRender({ brand, sections: [tree] });
        else spaRender(tree);
      };
      expect(invoke).not.toThrow();
    },
  );
});
