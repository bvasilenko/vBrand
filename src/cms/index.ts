// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import type { CmsName, ContentTree, SchemaTree } from './types.js';
import { DEFAULT_CMS } from './types.js';
import { vbrandStandaloneCms } from './vbrand-standalone.js';
import { payloadCms } from './payload.js';
import { sanityCms } from './sanity.js';
import { strapiCms } from './strapi.js';

export type { CmsName, ContentTree, SchemaTree } from './types.js';
export { DEFAULT_CMS, parseCms, CmsNameSchema, CMS_NAMES } from './types.js';
export { loadFixtureContentTree, loadFixtureSchema, resolveFixtureSlug, CMS_FIXTURE_SLUGS } from './content-tree.js';
export { normalizePayloadResponse, payloadPagesFixture, payloadCollectionsFixture } from './payload.js';
export { normalizeSanityResponse, sanityPagesFixture, sanitySchemaFixture } from './sanity.js';
export { normalizeStrapiResponse, strapiPagesFixture, strapiContentTypesFixture } from './strapi.js';
export { overridableFieldKeys } from './content-tree.js';

export interface CmsSubstrateAdapter {
  loadContent(slug?: string): Promise<ContentTree>;
  loadSchema(): Promise<SchemaTree>;
  name(): CmsName;
}

export const CMS_SUBSTRATE_REGISTRY: Record<CmsName, CmsSubstrateAdapter> = {
  'vbrand-standalone': vbrandStandaloneCms,
  payload: payloadCms,
  sanity: sanityCms,
  strapi: strapiCms,
};

export function getCmsSubstrate(name: CmsName): CmsSubstrateAdapter {
  return CMS_SUBSTRATE_REGISTRY[name] ?? CMS_SUBSTRATE_REGISTRY[DEFAULT_CMS];
}

export { vbrandStandaloneCms } from './vbrand-standalone.js';
export { payloadCms } from './payload.js';
export { sanityCms } from './sanity.js';
export { strapiCms } from './strapi.js';
