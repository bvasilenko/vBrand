// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import type { ContentOverrideMap, ContentOverrideValue } from './override.js';

function deepSet(
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> {
  const dotIndex = path.indexOf('.');
  if (dotIndex === -1) return { ...obj, [path]: value };
  const head = path.slice(0, dotIndex);
  const tail = path.slice(dotIndex + 1);
  const current = obj[head];
  const nested: Record<string, unknown> =
    current !== null && typeof current === 'object' && !Array.isArray(current)
      ? (current as Record<string, unknown>)
      : {};
  return { ...obj, [head]: deepSet(nested, tail, value) };
}

export function applyContentOverride<T extends Record<string, unknown>>(
  derived: T,
  overrides: ContentOverrideMap | undefined,
  scope: string,
): T {
  if (!overrides) return derived;
  const prefix = `${scope}.`;
  const applicable = (Object.entries(overrides) as Array<[string, ContentOverrideValue]>).filter(
    (entry): entry is [string, ContentOverrideValue] =>
      entry[0].startsWith(prefix) && entry[1] !== undefined,
  );
  if (applicable.length === 0) return derived;
  return applicable.reduce<Record<string, unknown>>(
    (acc, [key, val]) => deepSet(acc, key.slice(prefix.length), val),
    { ...(derived as Record<string, unknown>) },
  ) as unknown as T;
}
