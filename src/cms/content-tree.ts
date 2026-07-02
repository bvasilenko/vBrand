// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { FIXTURE_SLUGS, loadFixture } from '@booga/vfixtures';
import type { VbrandType } from '../schema.js';
import { OVERRIDABLE_FIELDS } from '../content/fields.js';
import type { ContentOverrideKey, ContentOverrideValue } from '../content/override.js';
import type { ContentTree, SchemaTree } from './types.js';

export const DEFAULT_CONTENT_FIXTURE = 'stripe';
export const CMS_FIXTURE_SLUGS = [...FIXTURE_SLUGS];

export function resolveFixtureSlug(slug: string | undefined): (typeof FIXTURE_SLUGS)[number] {
  return (CMS_FIXTURE_SLUGS as readonly string[]).includes(slug ?? '') ? (slug as (typeof FIXTURE_SLUGS)[number]) : DEFAULT_CONTENT_FIXTURE;
}

export interface CanonicalCmsPage {
  readonly fixture: string;
  readonly brand: VbrandType;
  readonly content: ContentTree;
}

export interface CanonicalCmsDataset {
  readonly pages: readonly CanonicalCmsPage[];
}

export function brandToContentTree(brand: VbrandType): ContentTree {
  const entries: Array<[ContentOverrideKey, ContentOverrideValue]> = [];
  for (const fields of Object.values(OVERRIDABLE_FIELDS)) {
    for (const field of fields) entries.push([field.key, field.defaultValue(brand)]);
  }
  return Object.freeze(Object.fromEntries(entries) as Record<ContentOverrideKey, ContentOverrideValue>);
}

export function loadFixtureBrand(slug: (typeof FIXTURE_SLUGS)[number] = DEFAULT_CONTENT_FIXTURE): VbrandType {
  return loadFixture(slug) as VbrandType;
}

export function loadFixtureContentTree(slug: (typeof FIXTURE_SLUGS)[number] = DEFAULT_CONTENT_FIXTURE): ContentTree {
  return brandToContentTree(loadFixtureBrand(slug));
}

export function loadFixtureSchema(slug: (typeof FIXTURE_SLUGS)[number] = DEFAULT_CONTENT_FIXTURE): SchemaTree {
  return loadFixtureBrand(slug);
}

export function canonicalDataset(): CanonicalCmsDataset {
  return { pages: CMS_FIXTURE_SLUGS.map((fixture) => ({ fixture, brand: loadFixtureBrand(fixture), content: loadFixtureContentTree(fixture) })) };
}

export function overridableFieldKeys(): ContentOverrideKey[] {
  return Object.values(OVERRIDABLE_FIELDS).flat().map((field) => field.key);
}

export function assertKnownContentKeys(tree: ContentTree): ContentTree {
  const known = new Set(overridableFieldKeys());
  const unknown = Object.keys(tree).filter((key) => !known.has(key as ContentOverrideKey));
  if (unknown.length > 0) throw new Error(`Unknown CMS content keys: ${unknown.join(', ')}`);
  return tree;
}
