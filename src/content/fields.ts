// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import type { ContentOverrideKey } from './override.js';
import type { VbrandType } from '../schema.js';
import {
  deriveHeroContent,
  deriveFeaturesContent,
  deriveCtaContent,
  deriveFooterContent,
  deriveMarketingTestimonialsContent,
  deriveMarketingPricingContent,
  deriveDocsSidebarContent,
  deriveDocsArticleContent,
  deriveDocsTocContent,
  deriveDashboardSidebarContent,
  deriveDashboardStatsContent,
  deriveDashboardGridContent,
} from '../templates/content-derivers.js';

export type FieldKind = 'text' | 'list';

export interface OverridableField {
  readonly key: ContentOverrideKey;
  readonly label: string;
  readonly defaultValue: (brand: VbrandType) => string;
  readonly kind: FieldKind;
}

export const OVERRIDABLE_FIELDS: Readonly<Record<string, readonly OverridableField[]>> = {
  landing: [
    { key: 'landing.hero.heading',         label: 'Hero heading',       defaultValue: (b) => deriveHeroContent(b).heading,                  kind: 'text' },
    { key: 'landing.hero.eyebrow',         label: 'Hero eyebrow',       defaultValue: (b) => deriveHeroContent(b).eyebrow,                  kind: 'text' },
    { key: 'landing.hero.description',     label: 'Hero description',   defaultValue: (b) => deriveHeroContent(b).description,              kind: 'text' },
    { key: 'landing.hero.primaryCta.label',label: 'Hero CTA label',     defaultValue: (b) => deriveHeroContent(b).primaryCta.label,         kind: 'text' },
    { key: 'landing.features.heading',     label: 'Features heading',   defaultValue: (b) => deriveFeaturesContent(b).heading,              kind: 'text' },
    { key: 'landing.cta.heading',          label: 'CTA heading',        defaultValue: (b) => deriveCtaContent(b).heading,                   kind: 'text' },
    { key: 'landing.cta.description',      label: 'CTA description',    defaultValue: (b) => deriveCtaContent(b).description,               kind: 'text' },
    { key: 'landing.cta.primaryCta.label', label: 'CTA button label',   defaultValue: (b) => deriveCtaContent(b).primaryCta.label,          kind: 'text' },
    { key: 'landing.footer.copyright',     label: 'Footer copyright',   defaultValue: (b) => deriveFooterContent(b).copyright,              kind: 'text' },
  ],
  marketing: [
    { key: 'marketing.hero.heading',           label: 'Hero heading',          defaultValue: (b) => deriveHeroContent(b).heading,                         kind: 'text' },
    { key: 'marketing.hero.eyebrow',           label: 'Hero eyebrow',          defaultValue: (b) => deriveHeroContent(b).eyebrow,                         kind: 'text' },
    { key: 'marketing.hero.description',       label: 'Hero description',      defaultValue: (b) => deriveHeroContent(b).description,                     kind: 'text' },
    { key: 'marketing.testimonials.heading',   label: 'Testimonials heading',  defaultValue: (b) => deriveMarketingTestimonialsContent(b).heading,         kind: 'text' },
    { key: 'marketing.pricing.heading',        label: 'Pricing heading',       defaultValue: (b) => deriveMarketingPricingContent(b).heading,              kind: 'text' },
    { key: 'marketing.cta.primaryCta.label',   label: 'CTA button label',      defaultValue: (b) => deriveCtaContent(b).primaryCta.label,                 kind: 'text' },
  ],
  docs: [
    { key: 'docs.sidebar.heading', label: 'Sidebar heading', defaultValue: (b) => deriveDocsSidebarContent(b).heading,  kind: 'text' },
    { key: 'docs.article.title',   label: 'Article title',   defaultValue: (b) => deriveDocsArticleContent(b).title,    kind: 'text' },
    { key: 'docs.toc.heading',     label: 'TOC heading',     defaultValue: (b) => deriveDocsTocContent(b).heading,      kind: 'text' },
  ],
  dashboard: [
    { key: 'dashboard.sidebar.heading', label: 'Sidebar heading', defaultValue: (b) => deriveDashboardSidebarContent(b).heading, kind: 'text' },
    { key: 'dashboard.stats.heading',   label: 'Stats heading',   defaultValue: (b) => deriveDashboardStatsContent(b).heading,   kind: 'text' },
    { key: 'dashboard.grid.heading',    label: 'Grid heading',    defaultValue: ()  => deriveDashboardGridContent().heading,     kind: 'text' },
  ],
};
