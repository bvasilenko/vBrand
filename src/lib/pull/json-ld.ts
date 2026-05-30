// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko

import { parse as parseHtml } from 'node-html-parser';
import { isColorValue } from './color-value.js';

export interface JsonLdSignals {
  orgName: string | undefined;
  description: string | undefined;
  brandColor: string | undefined;
}

function isRecord(val: unknown): val is Record<string, unknown> {
  return val !== null && typeof val === 'object' && !Array.isArray(val);
}

function trimmedString(val: unknown): string | undefined {
  return typeof val === 'string' && val.trim().length > 0 ? val.trim() : undefined;
}

function schemaType(node: Record<string, unknown>): string | undefined {
  const t = node['@type'];
  return typeof t === 'string' ? t : undefined;
}

export function flattenJsonLdNodes(root: ReturnType<typeof parseHtml>): unknown[] {
  const nodes: unknown[] = [];
  for (const el of root.querySelectorAll('script[type="application/ld+json"]')) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(el.text);
    } catch {
      continue;
    }
    if (Array.isArray(parsed)) {
      nodes.push(...parsed);
    } else if (isRecord(parsed) && Array.isArray(parsed['@graph'])) {
      nodes.push(...(parsed['@graph'] as unknown[]));
    } else {
      nodes.push(parsed);
    }
  }
  return nodes;
}

const ORG_TYPES = new Set(['Organization', 'LocalBusiness', 'Corporation']);

export function extractJsonLdSignals(nodes: unknown[]): JsonLdSignals {
  let orgName: string | undefined;
  let description: string | undefined;
  let brandColor: string | undefined;

  for (const node of nodes) {
    if (!isRecord(node)) continue;
    const type = schemaType(node);

    if (type !== undefined && ORG_TYPES.has(type)) {
      if (!orgName) orgName = trimmedString(node['name']);
      if (!description) description = trimmedString(node['description']);
      if (!brandColor) {
        const brand = node['brand'];
        if (isRecord(brand)) {
          const raw = trimmedString(brand['color']);
          if (raw && isColorValue(raw)) brandColor = raw;
        }
      }
    }

    if (type === 'Brand' && !brandColor) {
      const raw = trimmedString(node['color']);
      if (raw && isColorValue(raw)) brandColor = raw;
    }

    if (type === 'WebSite' && !description) {
      description = trimmedString(node['description']);
    }
  }

  return { orgName, description, brandColor };
}
