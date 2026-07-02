// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import fs from 'node:fs';
import path from 'node:path';
import { STACKS } from './axes.mjs';

function extractViteLines(html) {
  const m = html.match(/<script[^>]+id="__VBRAND_VITE_BOOTSTRAP_PREVIEW__"[^>]*>(.*?)<\/script>/s);
  return [
    '<script id="__VBRAND_VITE_BOOTSTRAP_PREVIEW__">',
    m ? m[1].trim() : '(not found)',
    '</script>',
  ];
}

function extractNextLines(html) {
  const dataMatch   = html.match(/<script[^>]+id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
  const flightMatch = html.match(/<script[^>]+data-next-flight-preview[^>]*>(.*?)<\/script>/s);
  if (!dataMatch) return ['(not found)'];
  const parsed = JSON.parse(dataMatch[1]);
  return [
    '<script id="__NEXT_DATA__">',
    `"page":"${parsed.page}"`,
    `"buildId":"${parsed.buildId}"`,
    `"islands":[${(parsed.props?.islands ?? []).map((id) => `"${id}"`).join(',')}]`,
    '</script>',
    `<script data-next-flight-preview>${(flightMatch?.[1] ?? '').trim().slice(0, 60)}</script>`,
  ];
}

function extractAstroLines(html) {
  const islandMatch    = html.match(/<astro-island([^>]*)>/);
  const hydrationMatch = html.match(/<script[^>]+data-astro-component-hydration[^>]*>(.*?)<\/script>/s);
  const attrs          = (islandMatch?.[1] ?? '').trim().split(/\s+/).filter(Boolean).map((a) => `  ${a}`);
  return [
    '<astro-island',
    ...attrs,
    '>',
    '<script data-astro-component-hydration>',
    (hydrationMatch?.[1] ?? '(not found)').trim(),
    '</script>',
  ];
}

const EXTRACTORS = { vite: extractViteLines, next: extractNextLines, astro: extractAstroLines };

export function loadStackEmitShapes(distDir) {
  return Object.fromEntries(
    STACKS.map((stack) => {
      const filePath = path.join(distDir, 'stacks', `${stack}.html`);
      try {
        return [stack, EXTRACTORS[stack](fs.readFileSync(filePath, 'utf-8'))];
      } catch {
        return [stack, [`dist/stacks/${stack}.html`, '(not found -- run build first)']];
      }
    }),
  );
}
