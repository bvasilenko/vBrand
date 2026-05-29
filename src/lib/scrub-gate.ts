// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { readFileSync } from 'node:fs';

export interface ScrubFinding {
  field: string;
  value: string;
  pattern: string;
}

export function loadScrubPatterns(scrubListPath: string): string[] {
  const text = readFileSync(scrubListPath, 'utf-8');
  return text
    .split('\n')
    .map((line) => line.replace(/#.*$/, '').trim())
    .filter(Boolean)
    .map((p) => p.toLowerCase());
}

function collectStrings(obj: unknown, path: string, acc: Array<[string, string]>): void {
  if (typeof obj === 'string') {
    acc.push([path, obj]);
    return;
  }
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => collectStrings(item, `${path}[${i}]`, acc));
    return;
  }
  if (obj !== null && typeof obj === 'object') {
    for (const [key, val] of Object.entries(obj)) {
      collectStrings(val, path ? `${path}.${key}` : key, acc);
    }
  }
}

export function runScrubGate(data: unknown, patterns: string[]): ScrubFinding[] {
  const leaves: Array<[string, string]> = [];
  collectStrings(data, '', leaves);

  const findings: ScrubFinding[] = [];
  for (const [field, value] of leaves) {
    const lower = value.toLowerCase();
    for (const pattern of patterns) {
      if (lower.includes(pattern)) {
        findings.push({ field, value: value.slice(0, 120), pattern });
      }
    }
  }
  return findings;
}

export function loadAvatarVoice(avatarPath: string): string {
  return readFileSync(avatarPath, 'utf-8');
}
