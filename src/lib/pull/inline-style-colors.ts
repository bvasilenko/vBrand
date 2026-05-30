// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko

import { parse as parseHtml } from 'node-html-parser';

const CSS_COLOR_VAR_RE =
  /--[\w-]*color[\w-]*\s*:\s*(#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![0-9a-fA-F])|rgba?\([^)]+\))/gi;

const INLINE_COLOR_CAP = 4;

export function extractInlineStyleColors(root: ReturnType<typeof parseHtml>): string[] {
  const colors: string[] = [];
  const seen = new Set<string>();
  for (const el of root.querySelectorAll('style')) {
    for (const match of el.text.matchAll(CSS_COLOR_VAR_RE)) {
      const value = match[1]?.trim();
      if (value && !seen.has(value)) {
        seen.add(value);
        colors.push(value);
        if (colors.length >= INLINE_COLOR_CAP) return colors;
      }
    }
  }
  return colors;
}
