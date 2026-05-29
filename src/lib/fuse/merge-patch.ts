// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return val !== null && typeof val === 'object' && !Array.isArray(val);
}

export function mergePatch(target: unknown, patch: unknown): unknown {
  if (!isPlainObject(patch)) return patch;

  const result: Record<string, unknown> = isPlainObject(target)
    ? { ...target }
    : {};

  for (const [key, value] of Object.entries(patch)) {
    if (value === null) {
      delete result[key];
    } else {
      result[key] = mergePatch(result[key], value);
    }
  }
  return result;
}

export function applyMergePatchSequence(schemas: unknown[]): unknown {
  if (schemas.length === 0) throw new Error('fuse requires at least one schema');
  return schemas.reduce((acc, patch) => mergePatch(acc, patch));
}
