// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import type { CmsSubstrateAdapter } from './index.js';
import type { ContentTree, SchemaTree } from './types.js';
import { assertKnownContentKeys, canonicalDataset, loadFixtureSchema, overridableFieldKeys } from './content-tree.js';

export interface SanityPagesResponse { readonly result: readonly { readonly _id: string; readonly slug: { readonly current: string }; readonly content: ContentTree }[] }
export interface SanitySchemaResponse { readonly types: readonly { readonly name: string; readonly fields: readonly string[] }[] }

export function sanityPagesFixture(): SanityPagesResponse {
  return { result: canonicalDataset().pages.map((page) => ({ _id: `page.${page.fixture}`, slug: { current: page.fixture }, content: page.content })) };
}

export function sanitySchemaFixture(): SanitySchemaResponse {
  return { types: [{ name: 'page', fields: overridableFieldKeys() }] };
}

export function normalizeSanityResponse(raw: SanityPagesResponse, slug = 'stripe'): ContentTree {
  const page = raw.result.find((doc) => doc.slug.current === slug) ?? raw.result[0];
  if (!page) throw new Error('Sanity fixture contains no pages');
  return assertKnownContentKeys(page.content);
}

export function normalizeSanitySchema(_raw: SanitySchemaResponse): SchemaTree {
  return loadFixtureSchema();
}

export const sanityCms: CmsSubstrateAdapter = {
  name: () => 'sanity',
  loadContent: async (slug) => normalizeSanityResponse(sanityPagesFixture(), slug),
  loadSchema: async () => normalizeSanitySchema({ types: [] }),
};
