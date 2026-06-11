// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import React from 'react';
import { HeroSplit } from '@booga/vblocks/hero';
import { TestimonialGrid } from '@booga/vblocks/testimonial';
import { CtaCentered } from '@booga/vblocks/cta';
import { FooterSplit } from '@booga/vblocks/footer';
import { Box, Stack, Card, CardHeader, CardTitle, CardContent, Inline } from '@booga/vui';
import type { VbrandType } from '../schema.js';
import type { CompositionSpec } from '../composition/spec.js';
import { visibleSections } from '../composition/spec.js';
import type { AppTypeTemplate, ContentOverrideMap } from './types.js';
import {
  deriveHeroContent,
  deriveCtaContent,
  deriveFooterContent,
  deriveMarketingTestimonialsContent,
  deriveMarketingPricingContent,
  deriveThemeOverride,
} from './content-derivers.js';
import type { Density } from '../composition/spec.js';
import { applyContentOverride } from '../content/apply.js';
import { markIsland } from '../interactivity/islands.js';

const SECTION_IDS = ['hero', 'testimonials', 'pricing', 'cta', 'footer'] as const;
type MarketingSectionId = (typeof SECTION_IDS)[number];

export const marketingTemplate: AppTypeTemplate = {
  templateId: () => 'marketing',

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
      .filter((s): s is typeof s & { id: MarketingSectionId } =>
        (SECTION_IDS as readonly string[]).includes(s.id),
      )
      .map((s) => renderSection(brand, s.id, s.density, theme, content));

    return <div style={{ display: 'flex', flexDirection: 'column' }}>{rendered}</div>;
  },
};

function renderSection(
  brand: VbrandType,
  id: MarketingSectionId,
  density: string,
  theme: Record<string, string>,
  content?: ContentOverrideMap,
) {
  const d = density as Density;
  switch (id) {
    case 'hero':
      return markIsland(<HeroSplit content={applyContentOverride(deriveHeroContent(brand, d), content, 'marketing.hero')} theme={theme} />, 'marketing.hero');
    case 'testimonials':
      return (
        <TestimonialGrid
          key="testimonials"
          content={applyContentOverride(deriveMarketingTestimonialsContent(brand, d), content, 'marketing.testimonials')}
          theme={theme}
        />
      );
    case 'pricing':
      return <PricingSection key="pricing" brand={brand} content={applyContentOverride(deriveMarketingPricingContent(brand), content, 'marketing.pricing')} />;
    case 'cta':
      return markIsland(<CtaCentered content={applyContentOverride(deriveCtaContent(brand, d), content, 'marketing.cta')} theme={theme} />, 'marketing.cta');
    case 'footer':
      return <FooterSplit key="footer" content={applyContentOverride(deriveFooterContent(brand, d), content, 'marketing.footer')} theme={theme} />;
  }
}

interface PricingSectionProps {
  brand: VbrandType;
  content: ReturnType<typeof deriveMarketingPricingContent>;
}

function PricingSection({ brand, content }: PricingSectionProps) {
  const tiers = [
    { name: 'Starter', price: 'Free', features: ['5 brand sources', 'Core tokens', 'CLI access'] },
    {
      name: 'Pro',
      price: '$29/mo',
      features: ['Unlimited sources', 'Full token suite', 'API access', 'Priority support'],
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      features: ['Self-hosted', 'Custom integrations', 'SLA', 'Dedicated support'],
    },
  ];

  return (
    <Box as="section" style={{ padding: '64px 24px', background: 'var(--color-neutral-50, #f9fafb)' }}>
      <Stack style={{ gap: '32px', maxWidth: '1200px', margin: '0 auto' }}>
        <Stack style={{ gap: '8px', textAlign: 'center' }}>
          <h2 style={{ fontFamily: `var(--type-heading, system-ui)`, fontSize: '2rem', margin: 0 }}>
            {content.heading}
          </h2>
          <p style={{ color: 'var(--color-neutral-500, #6b7280)', margin: 0 }}>
            {brand.voice.canonical}
          </p>
        </Stack>
        <Inline wrap style={{ gap: '16px', justifyContent: 'center', alignItems: 'stretch' }}>
          {tiers.map((tier) => (
            <Card key={tier.name} style={{ flex: '0 1 300px' }}>
              <CardHeader>
                <CardTitle>{tier.name}</CardTitle>
                <p style={{ fontSize: '1.5rem', fontWeight: 700, margin: '8px 0 0' }}>{tier.price}</p>
              </CardHeader>
              <CardContent>
                <Stack style={{ gap: '8px' }}>
                  {tier.features.map((f) => (
                    <span key={f} style={{ fontSize: '0.875rem' }}>
                      {f}
                    </span>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Inline>
      </Stack>
    </Box>
  );
}
