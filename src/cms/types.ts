// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { z } from 'zod';
import type { VbrandType } from '../schema.js';
import type { ContentOverrideKey, ContentOverrideValue } from '../content/override.js';

export const CMS_NAMES = ['vbrand-standalone', 'payload', 'sanity', 'strapi'] as const;
export const CmsNameSchema = z.enum(CMS_NAMES);
export type CmsName = z.infer<typeof CmsNameSchema>;
export const DEFAULT_CMS: CmsName = 'vbrand-standalone';

export type ContentTree = Readonly<Partial<Record<ContentOverrideKey, ContentOverrideValue>>>;
export type SchemaTree = VbrandType;

export function parseCms(raw: string | null | undefined): CmsName {
  const result = CmsNameSchema.safeParse(raw);
  return result.success ? result.data : DEFAULT_CMS;
}
