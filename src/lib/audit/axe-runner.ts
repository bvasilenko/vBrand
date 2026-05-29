// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';

const _require = createRequire(import.meta.url);

const STATIC_HTML_SAFE_RULES: string[] = [
  'image-alt',
  'heading-order',
  'label',
  'region',
  'landmark-no-duplicate-banner',
  'landmark-no-duplicate-contentinfo',
  'landmark-one-main',
  'aria-allowed-attr',
  'aria-hidden-body',
  'aria-input-field-name',
  'aria-required-attr',
  'aria-required-children',
  'aria-required-parent',
  'aria-roles',
  'aria-valid-attr',
  'aria-valid-attr-value',
  'document-title',
  'duplicate-id',
  'duplicate-id-aria',
];

const DISABLED_RULES: Record<string, { enabled: false }> = {
  'color-contrast': { enabled: false },
  'focus-order-semantics': { enabled: false },
};

export interface AxeFinding {
  ruleId: string;
  description: string;
  help: string;
  impact: string;
  nodeCount: number;
}

interface AxeViolation {
  id: string;
  description: string;
  help: string;
  impact?: string | null;
  nodes: unknown[];
}

interface AxeResults {
  violations: AxeViolation[];
}

interface WindowWithAxe extends Window {
  axe: {
    run: (
      context: Document,
      options: {
        runOnly?: { type: string; values: string[] };
        rules?: Record<string, { enabled: boolean }>;
      },
    ) => Promise<AxeResults>;
  };
}

export async function runAxe(html: string): Promise<AxeFinding[]> {
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://vbrand-audit.local',
  });

  const axePath = _require.resolve('axe-core/axe.min.js');
  const axeScript = readFileSync(axePath, 'utf-8');
  dom.window.eval(axeScript);

  const win = dom.window as unknown as WindowWithAxe;

  const results = await win.axe.run(dom.window.document, {
    runOnly: {
      type: 'rule',
      values: STATIC_HTML_SAFE_RULES,
    },
    rules: DISABLED_RULES,
  });

  return results.violations.map((v) => ({
    ruleId: v.id,
    description: v.description,
    help: v.help,
    impact: v.impact ?? 'unknown',
    nodeCount: v.nodes.length,
  }));
}
