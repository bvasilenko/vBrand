// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { scanForHandleLeaks } from './handle-audit.js';
import type { HandleLeakFinding } from './types.js';

export interface ScrubResult {
  scrubbed: unknown;
  removedPaths: string[];
}

export interface HandleAuditOutcome {
  ok: true;
}

export interface HandleLeakOutcome {
  ok: false;
  findings: HandleLeakFinding[];
}

export type AuditOutcome = HandleAuditOutcome | HandleLeakOutcome;

function containsHandle(value: string, handles: string[]): boolean {
  return scanForHandleLeaks(value, handles).length > 0;
}

function scrubValue(value: unknown, handles: string[], path: string, removed: string[]): unknown {
  if (typeof value === 'string') {
    if (containsHandle(value, handles)) {
      removed.push(path);
      return null;
    }
    return value;
  }

  if (Array.isArray(value)) {
    const filtered: unknown[] = [];
    for (let i = 0; i < value.length; i++) {
      const item = value[i];
      if (typeof item === 'string' && containsHandle(item, handles)) {
        removed.push(`${path}[${i}]`);
      } else if (typeof item === 'object' && item !== null) {
        const cleaned = scrubValue(item, handles, `${path}[${i}]`, removed);
        filtered.push(cleaned);
      } else {
        filtered.push(item);
      }
    }
    return filtered;
  }

  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(obj)) {
      const childPath = path ? `${path}.${key}` : key;
      if (containsHandle(key, handles)) {
        removed.push(childPath);
        continue;
      }
      const cleaned = scrubValue(child, handles, childPath, removed);
      if (cleaned !== null) {
        result[key] = cleaned;
      } else if (typeof child !== 'string') {
        result[key] = cleaned;
      } else {
        removed.push(childPath);
      }
    }
    return result;
  }

  return value;
}

export function scrubHandles(bundle: unknown, handles: string[]): ScrubResult {
  if (handles.length === 0) return { scrubbed: bundle, removedPaths: [] };
  const removedPaths: string[] = [];
  const scrubbed = scrubValue(bundle, handles, '', removedPaths);
  return { scrubbed, removedPaths };
}

export function auditPostScrub(bundle: unknown, handles: string[]): AuditOutcome {
  if (handles.length === 0) return { ok: true };
  const findings = scanForHandleLeaks(bundle, handles);
  if (findings.length === 0) return { ok: true };
  return { ok: false, findings };
}
