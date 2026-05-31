// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { FusePolicies, mergePatchWithPolicy } from './policy.js';
import { applyMergePatchSequence } from './merge-patch.js';

export type FuseStrategy = 'umbrella-wins' | 'merge-patch' | 'cascade';

export const UMBRELLA_WINS_STRATEGY: FuseStrategy = 'umbrella-wins';

function extractPolicies(schemas: unknown[]): FusePolicies {
  const combined: FusePolicies = {};
  for (const schema of schemas) {
    if (
      schema !== null &&
      typeof schema === 'object' &&
      !Array.isArray(schema) &&
      'fusePolicies' in schema &&
      typeof (schema as Record<string, unknown>)['fusePolicies'] === 'object'
    ) {
      Object.assign(combined, (schema as Record<string, unknown>)['fusePolicies']);
    }
  }
  return combined;
}

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return val !== null && typeof val === 'object' && !Array.isArray(val);
}

function umbrellaWins(schemas: unknown[]): unknown {
  if (schemas.length === 0) throw new Error('fuse requires at least one schema');
  const [umbrella, ...rest] = schemas;
  const policies = extractPolicies(schemas);

  let base: unknown = {};
  for (const schema of rest) {
    base = mergePatchWithPolicy(base, schema, policies);
  }
  return mergePatchWithPolicy(base, umbrella, policies);
}

function cascade(schemas: unknown[]): unknown {
  if (schemas.length === 0) throw new Error('fuse requires at least one schema');
  const policies = extractPolicies(schemas);

  let result: unknown = {};
  for (const schema of schemas) {
    result = mergePatchWithPolicy(result, schema, { ...policies, ...extractArrayUnionPolicies(schema) });
  }
  return result;
}

function extractArrayUnionPolicies(schema: unknown): FusePolicies {
  const policies: FusePolicies = {};
  if (!isPlainObject(schema)) return policies;
  visitArrayPaths(schema, '', policies);
  return policies;
}

function visitArrayPaths(obj: Record<string, unknown>, path: string, acc: FusePolicies): void {
  for (const [key, val] of Object.entries(obj)) {
    const childPath = path ? `${path}.${key}` : key;
    if (Array.isArray(val)) {
      acc[childPath] = 'array-union';
    } else if (isPlainObject(val)) {
      visitArrayPaths(val, childPath, acc);
    }
  }
}

export function applyStrategy(schemas: unknown[], strategy: FuseStrategy): unknown {
  switch (strategy) {
    case 'umbrella-wins':
      return umbrellaWins(schemas);
    case 'merge-patch':
      return applyMergePatchSequence(schemas);
    case 'cascade':
      return cascade(schemas);
  }
}
