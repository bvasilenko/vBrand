// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
//
// vBrand 0.3.0 demo - HONEST rendering of the literal pull output.
//
// This file renders `examples/demo/stripe-com.candidate.json`, which is the
// byte-for-byte output of:
//
//     npx @booga/vbrand@0.3.0 pull https://stripe.com
//
// run in a pristine npm consumer. There is no hand-tuned palette and no
// LLM-authored Stripe copy. Every brand string visible on the page either
// comes from `candidate.fields.<X>.value` or is rendered as a visible
// "missing: <reason>" / "extracted at <confidence>" indicator so a visitor
// sees the deterministic extractor's actual signal coverage on stripe.com.
//
// What 0.3.0's pull captures from stripe.com (high+medium):
//   - name              (medium, og:title)
//   - voiceCanonical    (high,   og:title)
//   - voiceDescription  (high,   og:description)
//   - favicon           (high,   link[rel=icon])
//   - og.dimensions     (high,   default)
//
// What is confidence: none on stripe.com today:
//   - colors            (dynamic-render-required; cannot be reached without JS execution)
//   - typeTokens, icons, marks, themes, illustration, slots, fusePolicies
//     (absent-in-source)
//
// Those gaps are rendered as warn-tone pills and inline notes, NOT silently
// filled with hand-tuned values. Once vBrand 0.3.1 ships fuse-baseline
// injection (AC#40 5-of-5 close), `vbrand fuse --baseline` will fill empty
// fields with baseline defaults at confidence:low and `vbrand emit` will
// produce `public/brand/brand-tokens.css` - at that point the visual gets
// proper brand tokens without any hand-tuning. Until then, the empty state
// IS the honest visual state.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@booga/vui/styles.css';
import './brand-tokens.css';

import { HeroSplit } from '@booga/vblocks/hero';
import { FeaturesGrid } from '@booga/vblocks/features';
import { CtaCentered } from '@booga/vblocks/cta';
import { FooterSplit } from '@booga/vblocks/footer';
import { Stack, Inline, Box, Kicker, Eyebrow, Pill, Card, CardHeader, CardTitle, CardContent } from '@booga/vui';

import candidate from '../stripe-com.candidate.json';

// 1x1 transparent PNG used wherever the strict block schema requires an
// image.src but the candidate has no extracted image asset. The candidate
// DOES carry a favicon (high confidence) but its value.source is a local
// filesystem cache path - it cannot be served from gh-pages. So we display
// the favicon path as text evidence in the hero card rather than wiring it
// to a <link rel="icon">.
const TRANSPARENT_PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

// --- Candidate readers ------------------------------------------------------
// Tiny helpers that surface confidence honestly. A field at confidence:none
// returns { present: false, reason } so the caller renders a warn indicator
// instead of a silent fallback.

function readField(name) {
  const f = candidate.fields?.[name];
  if (!f) return { present: false, reason: 'field-absent-from-candidate' };
  if (f.value === null || f.value === undefined) {
    return {
      present: false,
      confidence: f.confidence ?? 'none',
      reason: f.reason ?? 'value-null',
      suggestion: f.suggestion,
    };
  }
  return {
    present: true,
    value: f.value,
    confidence: f.confidence,
    source: f.source,
  };
}

const nameF = readField('name');
const voiceCanonicalF = readField('voiceCanonical');
const voiceDescriptionF = readField('voiceDescription');
const colorsF = readField('colors');
const typeTokensF = readField('typeTokens');
const faviconF = readField('favicon');
const ogF = readField('og');
const iconsF = readField('icons');
const marksF = readField('marks');
const themesF = readField('themes');

const sourceUri = candidate.sourceUri ?? '#';
const slug = candidate.slug ?? '(no-slug)';
const pulledAt = candidate.provenance?.pulledAt ?? '(unknown)';

// Hero CTA: candidate does NOT extract CTAs at 0.3.0. The deterministic thing
// to surface is the sourceUri itself - the URL the pull was run against.
const sourceCta = { label: 'Open source URL', href: sourceUri };
const candidateLinkCta = {
  label: 'View candidate JSON',
  href: 'https://github.com/bvasilenko/vBrand/blob/main/examples/demo/stripe-com.candidate.json',
};

// Tone pills that report the literal candidate state.
const candidatePills = [
  { label: `slug: ${slug}`, tone: 'meta' },
  { label: `name: ${nameF.present ? nameF.confidence : 'none'}`, tone: nameF.present ? 'ok' : 'warn' },
  { label: `voice: ${voiceDescriptionF.present ? voiceDescriptionF.confidence : 'none'}`, tone: voiceDescriptionF.present ? 'ok' : 'warn' },
  { label: `colors: ${colorsF.present ? colorsF.confidence : 'none'}`, tone: colorsF.present ? 'ok' : 'warn' },
  { label: `favicon: ${faviconF.present ? faviconF.confidence : 'none'}`, tone: faviconF.present ? 'ok' : 'warn' },
];

// Hero content. heading is required (zod.string); description is required.
// If the candidate did not extract one, render a clearly-marked placeholder
// rather than crash or silently invent copy.
const heroHeading = nameF.present
  ? nameF.value
  : `(name missing: ${nameF.reason})`;

const heroEyebrow = voiceCanonicalF.present
  ? voiceCanonicalF.value
  : `voiceCanonical missing: ${voiceCanonicalF.reason}`;

const heroDescription = voiceDescriptionF.present
  ? voiceDescriptionF.value
  : `voiceDescription missing: ${voiceDescriptionF.reason}`;

const heroContent = {
  kicker: `vBrand 0.3.0 pull - ${slug}`,
  eyebrow: heroEyebrow,
  heading: heroHeading,
  description: heroDescription,
  primaryCta: sourceCta,
  secondaryCta: candidateLinkCta,
  tonePills: candidatePills,
  density: 'spacious',
  image: {
    src: TRANSPARENT_PIXEL,
    alt: 'No og:image asset was downloaded by 0.3.0 pull (og.value records dimensions only)',
  },
};

// Features section. 0.3.0's pull does NOT extract feature/product cards from
// stripe.com - there is no "features" field on the candidate schema, and the
// adjacent fields (icons, marks, slots) are all confidence:none. So instead
// of inventing "Payments / Billing / Connect / Radar / Issuing / Atlas"
// (which is what the previous LLM-pastiche demo did), we render the
// confidence map of the candidate AS the features grid. Each card describes
// one candidate field and shows its actual confidence + reason. That is the
// only honest rendering of "what did the deterministic pull find?".
function fieldCard(label, f, extra) {
  if (f.present) {
    let valueText;
    if (typeof f.value === 'string') valueText = f.value;
    else if (typeof f.value === 'object') valueText = JSON.stringify(f.value);
    else valueText = String(f.value);
    return {
      title: `${label} - ${f.confidence}`,
      description: `source: ${f.source ?? '(none)'} | value: ${valueText.length > 160 ? valueText.slice(0, 157) + '...' : valueText}${extra ? ' | ' + extra : ''}`,
    };
  }
  return {
    title: `${label} - ${f.confidence ?? 'none'}`,
    description: `missing: ${f.reason ?? 'unknown'}${f.suggestion ? ' | suggestion: ' + f.suggestion : ''}${extra ? ' | ' + extra : ''}`,
  };
}

const featuresContent = {
  eyebrow: 'Deterministic pull coverage',
  heading: 'Every field the 0.3.0 pull reports for stripe.com',
  tonePills: [
    { label: 'no LLM in extraction', tone: 'ok' },
    { label: 'pulled at ' + pulledAt, tone: 'meta' },
  ],
  features: [
    fieldCard('name', nameF),
    fieldCard('voiceCanonical', voiceCanonicalF),
    fieldCard('voiceDescription', voiceDescriptionF),
    fieldCard('colors', colorsF, 'no extractable color signals; pre-baseline'),
    fieldCard('typeTokens', typeTokensF),
    fieldCard('favicon', faviconF, 'local cache only; not portable to gh-pages'),
    fieldCard('og', ogF),
    fieldCard('icons', iconsF),
    fieldCard('marks', marksF),
    fieldCard('themes', themesF),
  ],
};

// CTA section. Heading + description are required strings. We use the
// canonical voice line as the heading and a deterministic blurb describing
// the gap between pull (shipped) and fuse-baseline (0.3.1).
const ctaContent = {
  eyebrow: 'next step in the pipeline',
  heading: voiceCanonicalF.present
    ? voiceCanonicalF.value
    : `(voiceCanonical missing: ${voiceCanonicalF.reason})`,
  description:
    'This page shows the literal output of `vbrand pull` from npm. The next pipeline step, `vbrand fuse`, currently rejects this candidate against VbrandSchema.strict() because Stripe HTML does not expose tokens or assets.icons. The fix - fuse-baseline injection at confidence:low - lands in vBrand 0.3.1 (AC#40 5-of-5 close).',
  primaryCta: sourceCta,
  secondaryCta: candidateLinkCta,
};

// Footer. The pull does not extract footer links. We surface what IS in the
// candidate: source URL, slug, pulledAt. brand.name comes from the candidate
// when available; copyright is the provenance line. This is NOT hand-authored
// Stripe footer copy.
const footerContent = {
  brand: {
    name: nameF.present ? nameF.value : `(name missing: ${nameF.reason})`,
    tagline: voiceCanonicalF.present
      ? voiceCanonicalF.value
      : `voiceCanonical missing: ${voiceCanonicalF.reason}`,
  },
  links: [
    { label: 'Source URL', href: sourceUri },
    { label: 'Candidate JSON', href: candidateLinkCta.href },
    { label: 'vBrand on npm', href: 'https://www.npmjs.com/package/@booga/vbrand' },
    { label: 'vBrand repo', href: 'https://github.com/bvasilenko/vBrand' },
  ],
  copyright: `Rendered from \`npx @booga/vbrand pull ${sourceUri}\` at ${pulledAt}. No hand-tuned palette; no LLM-authored copy.`,
};

// Brand-mark strip above the hero. Surfaces the confidence summary of the
// candidate so the visual states up front what is high vs none.
function BrandMarkStrip() {
  return (
    <Box as="header" className="max-w-6xl mx-auto px-6 pt-16">
      <Inline wrap gap={3} align="center">
        <Kicker>vBrand 0.3.0 pull</Kicker>
        <Eyebrow tone="info">{slug}</Eyebrow>
        <Pill tone="meta">{`pulled at ${pulledAt}`}</Pill>
        {candidatePills.map((p) => (
          <Pill key={p.label} tone={p.tone}>{p.label}</Pill>
        ))}
      </Inline>
    </Box>
  );
}

// Evidence card under the hero. Surfaces the literal candidate.provenance
// payload + the favicon local cache path. This is the "honest representation"
// of fields that exist but cannot be rendered as live assets (favicon path is
// local cache only; og.value carries dimensions but no actual og:image was
// captured).
function ProvenanceEvidence() {
  return (
    <Box as="section" className="max-w-6xl mx-auto px-6 py-12">
      <Card>
        <CardHeader>
          <CardTitle>Provenance evidence (from candidate.provenance)</CardTitle>
        </CardHeader>
        <CardContent>
          <Stack gap={3}>
            <Inline wrap gap={2}>
              <Pill tone="meta">sourceUri</Pill>
              <span><a href={sourceUri}>{sourceUri}</a></span>
            </Inline>
            <Inline wrap gap={2}>
              <Pill tone="meta">pulledAt</Pill>
              <span>{pulledAt}</span>
            </Inline>
            {faviconF.present && (
              <Inline wrap gap={2} align="start">
                <Pill tone="ok">favicon (high)</Pill>
                <span>
                  cached locally at <code>{faviconF.value.source}</code>; sizes [{(faviconF.value.sizes ?? []).join(', ')}].
                  Not served from gh-pages because the cache path is local-fs only.
                </span>
              </Inline>
            )}
            {colorsF.present === false && (
              <Inline wrap gap={2} align="start">
                <Pill tone="warn">colors (none)</Pill>
                <span>{colorsF.reason} - {colorsF.suggestion ? <>workaround: <code>{colorsF.suggestion}</code></> : 'no workaround'}</span>
              </Inline>
            )}
            <Inline wrap gap={2} align="start">
              <Pill tone="info">degradations</Pill>
              <span>
                {(candidate.provenance?.degradations ?? []).map((d, i) => (
                  <span key={i}><code>{d.step}: {d.reason}</code>{i < (candidate.provenance?.degradations?.length ?? 0) - 1 ? '; ' : ''}</span>
                ))}
              </span>
            </Inline>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}

function App() {
  return (
    <Stack gap={0}>
      <BrandMarkStrip />
      <HeroSplit content={heroContent} />
      <ProvenanceEvidence />
      <FeaturesGrid content={featuresContent} />
      <CtaCentered content={ctaContent} />
      <FooterSplit content={footerContent} />
    </Stack>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode><App /></StrictMode>,
);
