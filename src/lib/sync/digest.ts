// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { createHash } from 'node:crypto';

function sortedStringify(value: unknown): string {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return JSON.stringify(value);
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const entries = keys.map((k) => `${JSON.stringify(k)}:${sortedStringify(obj[k])}`);
  return `{${entries.join(',')}}`;
}

export function digestJson(value: unknown): string {
  const canonical = sortedStringify(value);
  return createHash('sha256').update(canonical, 'utf-8').digest('hex');
}

export function digestBytes(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}
