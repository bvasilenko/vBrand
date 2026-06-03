// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { z } from 'zod';

export const CONTENT_OVERRIDE_KEYS = [
  'landing.hero.heading',
  'landing.hero.eyebrow',
  'landing.hero.description',
  'landing.hero.primaryCta.label',
  'landing.features.heading',
  'landing.cta.heading',
  'landing.cta.description',
  'landing.cta.primaryCta.label',
  'landing.footer.copyright',
  'marketing.hero.heading',
  'marketing.hero.eyebrow',
  'marketing.hero.description',
  'marketing.testimonials.heading',
  'marketing.pricing.heading',
  'marketing.cta.primaryCta.label',
  'docs.sidebar.heading',
  'docs.article.title',
  'docs.toc.heading',
  'dashboard.sidebar.heading',
  'dashboard.stats.heading',
  'dashboard.grid.heading',
] as const;

export type ContentOverrideKey = (typeof CONTENT_OVERRIDE_KEYS)[number];
export type ContentOverrideValue = string | string[];
export type ContentOverrideMap = Partial<Record<ContentOverrideKey, ContentOverrideValue>>;

export const ContentOverrideKeySchema = z.enum(CONTENT_OVERRIDE_KEYS);
export const ContentOverrideValueSchema = z.union([z.string(), z.array(z.string())]);
export const ContentOverrideMapSchema = z.record(
  ContentOverrideKeySchema,
  ContentOverrideValueSchema,
) as z.ZodType<ContentOverrideMap>;
