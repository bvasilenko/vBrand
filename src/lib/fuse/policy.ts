// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { FusePolicyHint } from '../../schema.js';

export type FusePolicies = Record<string, FusePolicyHint>;

export function policyFor(
  policies: FusePolicies,
  jsonPath: string,
): FusePolicyHint | undefined {
  return policies[jsonPath];
}

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return val !== null && typeof val === 'object' && !Array.isArray(val);
}

export function mergePatchWithPolicy(
  target: unknown,
  patch: unknown,
  policies: FusePolicies,
  currentPath = '',
): unknown {
  if (!isPlainObject(patch)) {
    const hint = policyFor(policies, currentPath);
    if (hint === 'null-keep' && patch === null) return patch;
    if (patch === null) return undefined;
    if (Array.isArray(patch) && Array.isArray(target)) {
      if (hint === 'array-union') {
        return [...new Set([...(target as unknown[]), ...(patch as unknown[])])];
      }
    }
    return patch;
  }

  const result: Record<string, unknown> = isPlainObject(target) ? { ...target } : {};

  for (const [key, value] of Object.entries(patch)) {
    const childPath = currentPath ? `${currentPath}.${key}` : key;
    const hint = policyFor(policies, childPath);

    if (value === null) {
      if (hint === 'null-keep') {
        result[key] = null;
      } else {
        delete result[key];
      }
    } else if (Array.isArray(value) && Array.isArray(result[key])) {
      if (hint === 'array-union') {
        result[key] = [
          ...new Set([...(result[key] as unknown[]), ...(value as unknown[])]),
        ];
      } else {
        result[key] = value;
      }
    } else {
      result[key] = mergePatchWithPolicy(result[key], value, policies, childPath);
    }
  }
  return result;
}
