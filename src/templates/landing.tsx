// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import React from 'react';
import { HeroSplit } from '@booga/vblocks/hero';
import { FeaturesGrid } from '@booga/vblocks/features';
import { CtaCentered } from '@booga/vblocks/cta';
import { FooterSplit } from '@booga/vblocks/footer';
import type { VbrandType } from '../schema.js';
import type { CompositionSpec } from '../composition/spec.js';
import { visibleSections } from '../composition/spec.js';
import type { AppTypeTemplate, ContentOverrideMap } from './types.js';
import {
  deriveHeroContent,
  deriveFeaturesContent,
  deriveCtaContent,
  deriveFooterContent,
  deriveThemeOverride,
} from './content-derivers.js';
import { applyContentOverride } from '../content/apply.js';

const SECTION_IDS = ['hero', 'features', 'cta', 'footer'] as const;
type LandingSectionId = (typeof SECTION_IDS)[number];

export const landingTemplate: AppTypeTemplate = {
  templateId: () => 'landing',

  defaultComposition: () => ({
    sections: SECTION_IDS.map((id, i) => ({
      id,
      visible: true,
      density: 'regular' as const,
      order: i,
    })),
  }),

  compose(brand: VbrandType, composition: CompositionSpec, content?: ContentOverrideMap) {
    const theme = deriveThemeOverride(brand);
    const visible = visibleSections(composition);
    const rendered = visible
      .filter((s): s is typeof s & { id: LandingSectionId } =>
        (SECTION_IDS as readonly string[]).includes(s.id),
      )
      .map((s) => renderSection(brand, s.id, s.density, theme, content));

    return <div style={{ display: 'flex', flexDirection: 'column' }}>{rendered}</div>;
  },
};

function renderSection(
  brand: VbrandType,
  id: LandingSectionId,
  density: string,
  theme: Record<string, string>,
  content?: ContentOverrideMap,
) {
  const d = density as 'compact' | 'regular' | 'spacious';
  switch (id) {
    case 'hero':
      return <HeroSplit key="hero" content={applyContentOverride(deriveHeroContent(brand, d), content, 'landing.hero')} theme={theme} />;
    case 'features':
      return <FeaturesGrid key="features" content={applyContentOverride(deriveFeaturesContent(brand, d), content, 'landing.features')} theme={theme} />;
    case 'cta':
      return <CtaCentered key="cta" content={applyContentOverride(deriveCtaContent(brand, d), content, 'landing.cta')} theme={theme} />;
    case 'footer':
      return <FooterSplit key="footer" content={applyContentOverride(deriveFooterContent(brand, d), content, 'landing.footer')} theme={theme} />;
  }
}
