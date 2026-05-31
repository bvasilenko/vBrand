// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
//
// vBrand 0.3.0 demo - Brand-OS thesis end-to-end.
//
// Pipeline being demonstrated:
//   1. vbrand pull stripe.com   -> brand candidate (voice, colors, marks)
//   2. vbrand fuse               -> fused brand spec
//   3. vbrand emit               -> tokens.css + content.json
//   4. drop tokens.css at :root and content into vBlocks sections
//      -> the brand renders as a real website composed of v-suite WebUI.
//
// This file is the deploy step: Stripe's brand tokens applied at :root via
// brand-tokens.css, every section rendered by @booga/vblocks 0.4.0 with the
// new richness fields (eyebrow, kicker, density, tonePills) consumed directly;
// no leaf-consumer CSS overrides. Typography (Playfair Display headlines,
// Inter body, JetBrains Mono code) is owned by @booga/vtheme 0.3.0 and
// inherited via the cascade.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@booga/vui/styles.css';
import './brand-tokens.css';

import { HeroSplit } from '@booga/vblocks/hero';
import { FeaturesGrid } from '@booga/vblocks/features';
import { CtaCentered } from '@booga/vblocks/cta';
import { FooterSplit } from '@booga/vblocks/footer';
import { Stack, Inline, Box, Kicker, Eyebrow, Pill } from '@booga/vui';

// 1x1 transparent PNG so the HeroSplit image slot validates without needing
// us to ship a 1200x630 OG image into the bundle. The hero's right column
// renders this as a brand-tinted surface via the wrapping Card.
const TRANSPARENT_PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

const STRIPE_BRAND_NAME = 'Stripe';
const STRIPE_HREF = 'https://stripe.com';

const heroContent = {
  kicker: 'Brand-OS demo',
  eyebrow: 'vBrand 0.3.0 - Stripe brand pulled and rendered',
  heading: 'Financial Infrastructure to Grow Your Revenue',
  description:
    'Join millions of companies that use Stripe to accept payments, send payouts, automate financial processes, and ultimately grow revenue. This page is rendered from a brand candidate pulled by vbrand from stripe.com - the same v-suite components, themed by tokens emitted at the brand step.',
  primaryCta: { label: 'Start now', href: STRIPE_HREF },
  secondaryCta: { label: 'Contact sales', href: STRIPE_HREF },
  tonePills: [
    { label: 'Stripe brand pulled', tone: 'info' },
    { label: 'compose-ssh deploy ready', tone: 'ok' },
    { label: 'v-suite WebUI', tone: 'meta' },
  ],
  density: 'spacious',
  image: {
    src: TRANSPARENT_PIXEL,
    alt: 'Stripe brand surface',
  },
};

const featuresContent = {
  eyebrow: 'A fully integrated suite',
  heading: 'A fully integrated suite of financial and payments products',
  tonePills: [
    { label: 'Schema-validated content', tone: 'info' },
    { label: 'Typed primitives', tone: 'ok' },
  ],
  features: [
    {
      title: 'Payments',
      description:
        'Accept payments online, in person, and around the world with a payments solution built for any business.',
    },
    {
      title: 'Billing',
      description:
        'Capture recurring revenue with a subscription billing platform that supports usage-based pricing and trials.',
    },
    {
      title: 'Connect',
      description:
        'Move money between your platform and the businesses on it with multi-party payments and global payouts.',
    },
    {
      title: 'Radar',
      description:
        'Fight fraud with the same machine-learning models that protect millions of businesses on the Stripe network.',
    },
    {
      title: 'Issuing',
      description:
        'Create, manage, and distribute physical and virtual payment cards programmatically from a single API.',
    },
    {
      title: 'Atlas',
      description:
        'Start a company at any time, from anywhere, with everything you need to incorporate and operate.',
    },
  ],
};

const ctaContent = {
  eyebrow: 'Ready when you are',
  heading: 'Start integrating Stripe products and tools',
  description:
    'Create a free account at any time to begin testing. Activate when you are ready to accept live payments.',
  primaryCta: { label: 'Create account', href: STRIPE_HREF },
  secondaryCta: { label: 'Read the docs', href: 'https://stripe.com/docs' },
};

const footerContent = {
  brand: {
    name: STRIPE_BRAND_NAME,
    tagline: 'Financial Infrastructure to Grow Your Revenue',
  },
  links: [
    { label: 'Products',  href: 'https://stripe.com/products' },
    { label: 'Pricing',   href: 'https://stripe.com/pricing' },
    { label: 'Customers', href: 'https://stripe.com/customers' },
    { label: 'Docs',      href: 'https://stripe.com/docs' },
    { label: 'About',     href: 'https://stripe.com/about' },
  ],
  copyright:
    'Brand pulled from stripe.com by vbrand 0.3.0. Rendered with @booga/vblocks + @booga/vui + @booga/vtheme.',
};

// Brand-mark strip sitting above the HeroSplit. Mirrors the proposal-style
// "engagement-tag + meta-row + brand-mark" header pattern, but built entirely
// from vUi 0.4.0 primitives (Kicker, Eyebrow, Pill) so no leaf-consumer CSS
// is needed. The Inline lays the row out; Pill carries the tone semantics.
function BrandMarkStrip() {
  return (
    <Box as="header" className="max-w-6xl mx-auto px-6 pt-16">
      <Inline wrap gap={3} align="center">
        <Kicker>vBrand 0.3.0</Kicker>
        <Eyebrow tone="info">Brand-OS demo</Eyebrow>
        <Pill tone="ok">pull - fuse - emit shipped</Pill>
        <Pill tone="info">Stripe brand applied</Pill>
        <Pill tone="meta">compose-ssh deploy ready</Pill>
      </Inline>
    </Box>
  );
}

function App() {
  return (
    <Stack gap={0}>
      <BrandMarkStrip />
      <HeroSplit content={heroContent} />
      <FeaturesGrid content={featuresContent} />
      <CtaCentered content={ctaContent} />
      <FooterSplit content={footerContent} />
    </Stack>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode><App /></StrictMode>,
);
