// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { ensureDir, fileExists } from '../fs.js';
import type { OverridesDoc, OverrideEntry } from './types.js';
import type { VbrandType } from '../../schema.js';

export const OVERRIDES_FILENAME = 'vbrand.overrides.json';

export function readOverrides(overridesPath: string): OverridesDoc | null {
  if (!fileExists(overridesPath)) return null;
  try {
    const raw = JSON.parse(readFileSync(overridesPath, 'utf-8')) as OverridesDoc;
    if (raw.$overrides !== true) return null;
    return raw;
  } catch {
    return null;
  }
}

export function writeOverrides(overridesPath: string, doc: OverridesDoc): void {
  ensureDir(dirname(overridesPath));
  writeFileSync(overridesPath, JSON.stringify(doc, null, 2) + '\n', 'utf-8');
}

export function createOverridesDoc(
  umbrellaUrl: string,
  baseDigest: string,
): OverridesDoc {
  return {
    $overrides: true,
    umbrella: umbrellaUrl,
    baseDigest,
    overrides: {},
  };
}

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return val !== null && typeof val === 'object' && !Array.isArray(val);
}

function getAtPath(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (!isPlainObject(current)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function setAtPath(
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> {
  const parts = path.split('.');
  const result = { ...obj };
  let current = result;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]!;
    current[key] = isPlainObject(current[key])
      ? { ...(current[key] as Record<string, unknown>) }
      : {};
    current = current[key] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]!] = value;
  return result;
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export interface ApplyOverridesResult {
  schema: VbrandType;
  heldFields: string[];
  observedValues: Record<string, unknown>;
}

export function applyOverrides(
  mergedSchema: VbrandType,
  overridesDoc: OverridesDoc,
): ApplyOverridesResult {
  const activeEntries = Object.entries(overridesDoc.overrides).filter(
    ([, entry]) => !entry.superseded,
  );

  if (activeEntries.length === 0) {
    return { schema: mergedSchema, heldFields: [], observedValues: {} };
  }

  const heldFields: string[] = [];
  const observedValues: Record<string, unknown> = {};
  let result = mergedSchema as unknown as Record<string, unknown>;

  for (const [path, entry] of activeEntries) {
    const umbrellaValue = getAtPath(result, path);
    if (!deepEqual(umbrellaValue, entry.value)) {
      heldFields.push(path);
      if (umbrellaValue !== undefined) {
        observedValues[path] = umbrellaValue;
      }
    }
    result = setAtPath(result, path, entry.value);
  }

  return {
    schema: result as unknown as VbrandType,
    heldFields,
    observedValues,
  };
}

export function setOverride(
  doc: OverridesDoc,
  field: string,
  value: unknown,
  reason?: string,
  setBy?: string,
): OverridesDoc {
  const entry: OverrideEntry = {
    value,
    setAt: new Date().toISOString(),
    ...(reason !== undefined ? { reason } : {}),
    ...(setBy !== undefined ? { setBy } : {}),
  };
  return {
    ...doc,
    overrides: { ...doc.overrides, [field]: entry },
  };
}

export function forgetOverride(doc: OverridesDoc, field: string): OverridesDoc {
  const existing = doc.overrides[field];
  if (!existing) return doc;
  const supersededEntry: OverrideEntry = { ...existing, superseded: true };
  return {
    ...doc,
    overrides: { ...doc.overrides, [field]: supersededEntry },
  };
}

export function activeOverrideCount(doc: OverridesDoc): number {
  return Object.values(doc.overrides).filter((e) => !e.superseded).length;
}
