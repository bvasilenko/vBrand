// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko

const PI_PATTERNS: RegExp[] = [
  /ignore\s+(previous|all|prior)\s+(instructions?|prompts?|rules?)/i,
  /system\s*:/i,
  /<\|im_start\|>/i,
  /\[INST\]/i,
  /\[SYS\]/i,
  /forget\s+(everything|all|prior)/i,
  /jailbreak/i,
  /DAN\s*mode/i,
  /you\s+are\s+now\s+(a|an)\s+/i,
  /disregard\s+(your|all|previous)/i,
  /act\s+as\s+if\s+you\s+(have\s+no|are\s+not)/i,
];

export interface PIFinding {
  field: string;
  value: string;
  pattern: string;
}

function collectStringLeaves(obj: unknown, path: string, findings: PIFinding[]): void {
  if (typeof obj === 'string') {
    for (const pattern of PI_PATTERNS) {
      if (pattern.test(obj)) {
        findings.push({ field: path, value: obj.slice(0, 120), pattern: pattern.source });
      }
    }
    return;
  }
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => collectStringLeaves(item, `${path}[${i}]`, findings));
    return;
  }
  if (obj !== null && typeof obj === 'object') {
    for (const [key, val] of Object.entries(obj)) {
      collectStringLeaves(val, path ? `${path}.${key}` : key, findings);
    }
  }
}

export function detectPI(data: unknown): PIFinding[] {
  const findings: PIFinding[] = [];
  collectStringLeaves(data, '', findings);
  return findings;
}
