// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import type { VbrandType } from '@booga/vbrand/adapters/browser';

type TokenRecord = Record<string, string>;

const CATEGORY_PREFIXES: Array<[keyof VbrandType['tokens'], string[]]> = [
  ['color',   ['--color-']],
  ['type',    ['--type-', '--font-']],
  ['spacing', ['--spacing-']],
  ['radius',  ['--radius-']],
  ['shadow',  ['--shadow-']],
  ['motion',  ['--motion-']],
  ['opacity', ['--opacity-']],
  ['zIndex',  ['--z-']],
];

export function applyBrandTokens(brand: VbrandType): string[] {
  const applied: string[] = [];
  const style = document.documentElement.style;

  for (const [category, prefixes] of CATEGORY_PREFIXES) {
    const group = brand.tokens[category] as TokenRecord | undefined;
    if (!group) continue;
    for (const [key, value] of Object.entries(group)) {
      for (const prefix of prefixes) {
        const prop = `${prefix}${key}`;
        style.setProperty(prop, value);
        applied.push(prop);
      }
    }
  }

  return applied;
}

export function clearBrandTokens(keys: string[]): void {
  const style = document.documentElement.style;
  for (const key of keys) {
    style.removeProperty(key);
  }
}
