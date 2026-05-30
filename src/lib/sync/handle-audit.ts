// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import type { HandleLeakFinding } from './types.js';

const SHORT_HANDLE_THRESHOLD = 6;

function buildMatcher(handle: string): (value: string) => boolean {
  const lower = handle.toLowerCase();
  if (lower.length <= SHORT_HANDLE_THRESHOLD) {
    const escaped = lower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp('\\b' + escaped + '\\b', 'i');
    return (v) => pattern.test(v);
  }
  return (v) => v.toLowerCase().includes(lower);
}

function collectTextNodes(
  value: unknown,
  pointer: string,
  acc: Array<[string, string]>,
): void {
  if (typeof value === 'string') {
    acc.push([pointer, value]);
    return;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      collectTextNodes(value[i], `${pointer}[${i}]`, acc);
    }
    return;
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const childPointer = pointer ? `${pointer}.${key}` : key;
      acc.push([childPointer + '@key', key]);
      collectTextNodes(child, childPointer, acc);
    }
  }
}

export function scanForHandleLeaks(
  bundle: unknown,
  handles: string[],
): HandleLeakFinding[] {
  if (handles.length === 0) return [];

  const matchers = handles.map((h) => ({ handle: h, test: buildMatcher(h) }));
  const nodes: Array<[string, string]> = [];
  collectTextNodes(bundle, '', nodes);

  const findings: HandleLeakFinding[] = [];
  for (const [rawPointer, text] of nodes) {
    const pointer = rawPointer.endsWith('@key')
      ? rawPointer.slice(0, -4)
      : rawPointer;
    for (const { handle, test } of matchers) {
      if (test(text)) {
        findings.push({
          jsonPointer: pointer,
          value: text.slice(0, 120),
          handle,
        });
      }
    }
  }
  return findings;
}
