// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko

export type LocatorType = 'local' | 'url' | 'gh' | 'npm';

export interface Locator {
  type: LocatorType;
  value: string;
}

export function parseLocator(source: string): Locator {
  if (source.startsWith('gh:')) return { type: 'gh', value: source.slice(3) };
  if (source.startsWith('npm:')) return { type: 'npm', value: source.slice(4) };
  if (source.startsWith('https://') || source.startsWith('http://')) {
    return { type: 'url', value: source };
  }
  return { type: 'local', value: source };
}
