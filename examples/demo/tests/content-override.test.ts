// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { describe, it, expect, beforeAll } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';
import { loadFromFixtureHandle } from '../../../src/adapters/brand-source/fixture-loader.js';
import { TEMPLATE_IDS, TEMPLATE_REGISTRY } from '../../../src/templates/registry.js';
import type { TemplateId } from '../../../src/templates/registry.js';
import { CONTENT_OVERRIDE_KEYS } from '../../../src/content/override.js';
import type { ContentOverrideMap } from '../../../src/content/override.js';

type Brand = Awaited<ReturnType<typeof loadFromFixtureHandle>>;

let brand: Brand;
beforeAll(async () => { brand = await loadFromFixtureHandle('stripe'); });

function render(templateId: TemplateId, content?: ContentOverrideMap): string {
  const template = TEMPLATE_REGISTRY[templateId];
  return renderToString(
    React.createElement(React.Fragment, null, template.compose(brand, template.defaultComposition(), content)),
  );
}

function sentinelFor(key: string): string {
  return `VBSENT_${key.replace(/\./g, '_').toUpperCase()}`;
}

describe('content override wiring: every registered key surfaces in the owning template render', () => {
  it.each([...CONTENT_OVERRIDE_KEYS])(
    '"%s" override surfaces the sentinel value in rendered HTML',
    (key) => {
      const templateId = key.split('.')[0] as TemplateId;
      const sentinel = sentinelFor(key);
      const html = render(templateId, { [key]: sentinel } as ContentOverrideMap);
      expect(html).toContain(sentinel);
    },
  );
});

describe('content override stability: compose() never throws regardless of override map', () => {
  it.each([...TEMPLATE_IDS])(
    '%s: compose() does not throw with an empty override map',
    (templateId) => {
      expect(() => render(templateId, {})).not.toThrow();
    },
  );

  it.each([...TEMPLATE_IDS])(
    '%s: compose() does not throw when content is undefined',
    (templateId) => {
      expect(() => render(templateId)).not.toThrow();
    },
  );

  it.each([...TEMPLATE_IDS])(
    '%s: empty override map produces the same output as no content argument',
    (templateId) => {
      expect(render(templateId, {})).toBe(render(templateId));
    },
  );

  it.each([...TEMPLATE_IDS])(
    '%s: compose() does not throw when all keys for the template are overridden simultaneously',
    (templateId) => {
      const overrides = Object.fromEntries(
        CONTENT_OVERRIDE_KEYS
          .filter((k) => k.startsWith(`${templateId}.`))
          .map((k, i) => [k, `VBMASS_${i}`]),
      ) as ContentOverrideMap;
      expect(() => render(templateId, overrides)).not.toThrow();
    },
  );
});

describe('content override multi: every key for a template surfaces when all are overridden simultaneously', () => {
  it.each([...TEMPLATE_IDS])(
    '%s: all template keys overridden at once all appear in the rendered HTML',
    (templateId) => {
      const keys = CONTENT_OVERRIDE_KEYS.filter((k) => k.startsWith(`${templateId}.`));
      const overrides = Object.fromEntries(keys.map((k) => [k, sentinelFor(k)])) as ContentOverrideMap;
      const html = render(templateId, overrides);
      for (const key of keys) {
        expect(html).toContain(sentinelFor(key));
      }
    },
  );
});

describe('content override scope isolation: a key from one template does not surface in another template render', () => {
  const crossPairs: ReadonlyArray<[TemplateId, TemplateId]> = [
    ['landing', 'marketing'],
    ['marketing', 'docs'],
    ['docs', 'dashboard'],
    ['dashboard', 'landing'],
  ];

  it.each(crossPairs)(
    'overriding all "%s" keys does not inject sentinels into "%s" render output',
    (overrideTemplate, renderTemplate) => {
      const sentinel = `XCROSS_${overrideTemplate.toUpperCase()}`;
      const overrides = Object.fromEntries(
        CONTENT_OVERRIDE_KEYS
          .filter((k) => k.startsWith(`${overrideTemplate}.`))
          .map((k) => [k, sentinel]),
      ) as ContentOverrideMap;
      expect(render(renderTemplate, overrides)).not.toContain(sentinel);
    },
  );
});

describe('content override partial: non-overridden fields retain brand-derived defaults', () => {
  it.each([...TEMPLATE_IDS])(
    '%s: after a single key override, the brand name still appears from non-overridden fields',
    (templateId) => {
      const templateKeys = CONTENT_OVERRIDE_KEYS.filter((k) => k.startsWith(`${templateId}.`));
      const overrides = { [templateKeys[0]!]: 'PARTIAL_SENTINEL' } as ContentOverrideMap;
      expect(render(templateId, overrides)).toContain(brand.name);
    },
  );

  it.each([...TEMPLATE_IDS])(
    '%s: overriding two keys independently does not produce the other key\'s sentinel value',
    (templateId) => {
      const templateKeys = CONTENT_OVERRIDE_KEYS.filter((k) => k.startsWith(`${templateId}.`));
      expect(templateKeys.length).toBeGreaterThanOrEqual(2);
      const keyA = templateKeys[0]!;
      const keyB = templateKeys[templateKeys.length - 1]!;
      const htmlOnlyA = render(templateId, { [keyA]: 'SENT_A' } as ContentOverrideMap);
      const htmlOnlyB = render(templateId, { [keyB]: 'SENT_B' } as ContentOverrideMap);
      expect(htmlOnlyA).toContain('SENT_A');
      expect(htmlOnlyA).not.toContain('SENT_B');
      expect(htmlOnlyB).toContain('SENT_B');
      expect(htmlOnlyB).not.toContain('SENT_A');
    },
  );
});
