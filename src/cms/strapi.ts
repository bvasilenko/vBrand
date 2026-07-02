// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import type { CmsSubstrateAdapter } from './index.js';
import type { ContentTree, SchemaTree } from './types.js';
import { assertKnownContentKeys, canonicalDataset, loadFixtureSchema, overridableFieldKeys } from './content-tree.js';

export interface StrapiPagesResponse { readonly data: readonly { readonly id: number; readonly attributes: { readonly slug: string; readonly content: ContentTree } }[] }
export interface StrapiContentTypesResponse { readonly contentTypes: readonly { readonly uid: string; readonly attributes: readonly string[] }[] }

export function strapiPagesFixture(): StrapiPagesResponse {
  return { data: canonicalDataset().pages.map((page, index) => ({ id: index + 1, attributes: { slug: page.fixture, content: page.content } })) };
}

export function strapiContentTypesFixture(): StrapiContentTypesResponse {
  return { contentTypes: [{ uid: 'api::page.page', attributes: overridableFieldKeys() }] };
}

export function normalizeStrapiResponse(raw: StrapiPagesResponse, slug = 'stripe'): ContentTree {
  const page = raw.data.find((doc) => doc.attributes.slug === slug) ?? raw.data[0];
  if (!page) throw new Error('Strapi fixture contains no pages');
  return assertKnownContentKeys(page.attributes.content);
}

export function normalizeStrapiSchema(_raw: StrapiContentTypesResponse): SchemaTree {
  return loadFixtureSchema();
}

export const strapiCms: CmsSubstrateAdapter = {
  name: () => 'strapi',
  loadContent: async (slug) => normalizeStrapiResponse(strapiPagesFixture(), slug),
  loadSchema: async () => normalizeStrapiSchema({ contentTypes: [] }),
};
