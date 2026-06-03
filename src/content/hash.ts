// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import type { ContentOverrideMap } from './override.js';
import { ContentOverrideMapSchema } from './override.js';

const CONTENT_HASH_KEY = 'content';

export function encodeContent(map: ContentOverrideMap): string {
  return btoa(JSON.stringify(map));
}

export function decodeContent(encoded: string): ContentOverrideMap | null {
  try {
    const decoded: unknown = JSON.parse(atob(encoded));
    const result = ContentOverrideMapSchema.safeParse(decoded);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function contentFromHash(hash: string): ContentOverrideMap | null {
  const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  const encoded = params.get(CONTENT_HASH_KEY);
  return encoded ? decodeContent(encoded) : null;
}

export function contentToHash(map: ContentOverrideMap): string {
  return `${CONTENT_HASH_KEY}=${encodeContent(map)}`;
}
