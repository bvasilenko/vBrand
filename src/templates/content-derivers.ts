// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import type { VbrandType } from '../schema.js';
import type { Density } from '../composition/spec.js';

export type BlockDensity = 'compact' | 'normal' | 'spacious';

export function toBlockDensity(d?: Density): BlockDensity | undefined {
  if (!d) return undefined;
  return d === 'regular' ? 'normal' : d;
}

export function deriveHeroContent(brand: VbrandType, density?: Density) {
  return {
    heading: brand.name,
    eyebrow: brand.voice.canonical,
    description: brand.voice.repoDescription,
    primaryCta: { label: 'Get started', href: '#' },
    image: {
      src: brand.assets.favicon.source,
      alt: `${brand.name} logo`,
    },
    density: toBlockDensity(density),
  } as const;
}

export function deriveFeaturesContent(brand: VbrandType, density?: Density) {
  const colorCount = Object.keys(brand.tokens.color).length;
  const typeCount = Object.keys(brand.tokens.type).length;
  return {
    heading: `What defines ${brand.name}`,
    features: [
      { title: 'Voice', description: brand.voice.canonical },
      { title: 'Identity', description: brand.voice.repoDescription },
      { title: 'Color tokens', description: `${colorCount} color design tokens` },
      { title: 'Type tokens', description: `${typeCount} typography design tokens` },
    ],
    density: toBlockDensity(density),
  };
}

export function deriveCtaContent(brand: VbrandType, density?: Density) {
  return {
    heading: `Build with ${brand.name}`,
    description: brand.voice.repoDescription,
    primaryCta: { label: 'Get started', href: '#' },
    density: toBlockDensity(density),
  } as const;
}

export function deriveFooterContent(brand: VbrandType, density?: Density) {
  const year = new Date().getFullYear();
  return {
    brand: {
      name: brand.name,
      tagline: brand.voice.canonical,
    },
    links: (brand.sources ?? []).length > 0
      ? brand.sources!.map((s) => ({ label: s, href: s }))
      : [{ label: brand.name, href: '#' }],
    copyright: `Copyright ${year} ${brand.name}`,
    density: toBlockDensity(density),
  } as const;
}

export function deriveTestimonialContent() {
  return {
    quote: 'This brand system powers our entire design language seamlessly.',
    author: 'Design Lead',
    role: 'Head of Design',
  } as const;
}

export function deriveBlogContent(brand: VbrandType, density?: Density) {
  return {
    heading: `${brand.name} insights`,
    posts: [
      {
        title: 'Design system foundations',
        excerpt: brand.voice.canonical,
        href: '#',
        date: new Date().toISOString().slice(0, 10),
        author: brand.name,
      },
    ],
    density: toBlockDensity(density),
  } as const;
}

export function deriveThemeOverride(brand: VbrandType): Record<string, string> {
  const overrides: Record<string, string> = {};
  if (brand.tokens.color['primary']) {
    overrides['--color-primary'] = brand.tokens.color['primary'];
  }
  if (brand.tokens.color['secondary']) {
    overrides['--color-secondary'] = brand.tokens.color['secondary'];
  }
  if (brand.tokens.type['body']) {
    overrides['--font-body'] = brand.tokens.type['body'];
  }
  if (brand.tokens.type['heading']) {
    overrides['--font-heading'] = brand.tokens.type['heading'];
  }
  return overrides;
}
