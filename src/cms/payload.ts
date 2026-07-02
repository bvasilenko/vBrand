// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import type { CmsSubstrateAdapter } from './index.js';
import type { ContentTree, SchemaTree } from './types.js';
import { assertKnownContentKeys, canonicalDataset, loadFixtureSchema, overridableFieldKeys } from './content-tree.js';

export interface PayloadPagesResponse { readonly docs: readonly { readonly slug: string; readonly content: ContentTree }[] }
export interface PayloadCollectionsResponse { readonly collections: readonly { readonly slug: string; readonly fields: readonly string[] }[] }

export function payloadPagesFixture(): PayloadPagesResponse {
  return { docs: canonicalDataset().pages.map((page) => ({ slug: page.fixture, content: page.content })) };
}

export function payloadCollectionsFixture(): PayloadCollectionsResponse {
  return { collections: [{ slug: 'pages', fields: overridableFieldKeys() }] };
}

export function normalizePayloadResponse(raw: PayloadPagesResponse, slug = 'stripe'): ContentTree {
  const page = raw.docs.find((doc) => doc.slug === slug) ?? raw.docs[0];
  if (!page) throw new Error('Payload fixture contains no pages');
  return assertKnownContentKeys(page.content);
}

export function normalizePayloadSchema(_raw: PayloadCollectionsResponse): SchemaTree {
  return loadFixtureSchema();
}

export const payloadCms: CmsSubstrateAdapter = {
  name: () => 'payload',
  loadContent: async (slug) => normalizePayloadResponse(payloadPagesFixture(), slug),
  loadSchema: async () => normalizePayloadSchema({ collections: [] }),
};
