// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko

import type { DegradationEntry, AssetProvenance } from './candidate-schema.js';
import { type CandidateField, highField, mediumField, lowField, noneField } from './confidence.js';
import type { PageSignals } from './html-signals.js';
import { sanitizeVoiceText } from './voice-text.js';
import { cacheAsset } from './asset-cache.js';

const DEFAULT_FAVICON_SIZES: [number, ...number[]] = [16, 32, 180, 512];
export const DEFAULT_OG_DIMENSIONS: [number, number] = [1200, 630];

function toColorMap(colors: string[]): Record<string, string> {
  return Object.fromEntries(colors.map((c, i) => [i === 0 ? 'primary' : `color-${i}`, c]));
}

export function buildNameField(
  signals: PageSignals,
  degradations: DegradationEntry[],
): CandidateField<string> {
  switch (signals.nameSource) {
    case 'og:site_name': return highField(signals.name, 'og:site_name');
    case 'og:title':     return mediumField(signals.name, 'og:title');
    case 'title':        return mediumField(signals.name, 'title');
    case 'hostname':
      degradations.push({ step: 'name-extract', reason: 'no-name-meta' });
      return lowField(signals.name, 'hostname', 'no-name-meta');
  }
}

export function buildVoiceCanonicalField(
  signals: PageSignals,
  degradations: DegradationEntry[],
): CandidateField<string> {
  if (signals.ogTitle)      return highField(sanitizeVoiceText(signals.ogTitle), 'og:title');
  if (signals.titleText)    return mediumField(sanitizeVoiceText(signals.titleText), 'title');
  if (signals.jsonLdOrgName) return mediumField(sanitizeVoiceText(signals.jsonLdOrgName), 'json-ld:Organization.name');
  degradations.push({ step: 'voice-canonical-extract', reason: 'absent-in-source' });
  return noneField('absent-in-source');
}

export function buildVoiceDescriptionField(
  signals: PageSignals,
  degradations: DegradationEntry[],
): CandidateField<string> {
  if (signals.ogDescription)   return highField(sanitizeVoiceText(signals.ogDescription), 'og:description');
  if (signals.metaDescription) return highField(sanitizeVoiceText(signals.metaDescription), 'meta[name=description]');
  if (signals.jsonLdDescription) return mediumField(sanitizeVoiceText(signals.jsonLdDescription), 'json-ld:description');
  degradations.push({ step: 'voice-description-extract', reason: 'absent-in-source' });
  return noneField('absent-in-source');
}

export function buildColorsField(
  signals: PageSignals,
  degradations: DegradationEntry[],
): CandidateField<Record<string, string>> {
  if (signals.themeColors.length > 0)      return highField(toColorMap(signals.themeColors), 'theme-color-meta');
  if (signals.jsonLdColors.length > 0)     return mediumField(toColorMap(signals.jsonLdColors), 'json-ld:Brand.color');
  if (signals.inlineStyleColors.length > 0) return lowField(toColorMap(signals.inlineStyleColors), 'inline-style-css-var', 'heuristic-color');
  degradations.push({ step: 'colors-extract', reason: 'dynamic-render-required' });
  return noneField('dynamic-render-required', '--color <hex>');
}

export async function buildFaviconField(
  signals: PageSignals,
  cacheDir: string | undefined,
  degradations: DegradationEntry[],
  assets: AssetProvenance[],
): Promise<CandidateField<{ source: string; sizes: number[] }>> {
  const candidateUrl = signals.faviconUrl ?? signals.logoUrl;

  if (cacheDir !== undefined && candidateUrl) {
    const { result, degradation } = await cacheAsset(candidateUrl, cacheDir, 'favicon');
    if (degradation) degradations.push(degradation);
    if (result.kind === 'hit') {
      assets.push({ field: 'assets.favicon', sourceUrl: candidateUrl, localPath: result.localPath });
      const source     = signals.faviconUrl ? 'link[rel=icon]' : 'img[alt*=logo]';
      const confidence = signals.faviconUrl ? ('high' as const) : ('medium' as const);
      return { value: { source: result.localPath, sizes: DEFAULT_FAVICON_SIZES }, confidence, source };
    }
    return noneField('download-failed', '--logo <path>');
  }

  if (signals.faviconUrl) {
    return lowField({ source: signals.faviconUrl, sizes: DEFAULT_FAVICON_SIZES }, 'link[rel=icon]', 'not-cached');
  }

  if (signals.ogImageUrl) {
    degradations.push({ step: 'favicon-extract', reason: 'og-image-is-marketing-card-not-mark' });
    return lowField({ source: signals.ogImageUrl, sizes: DEFAULT_FAVICON_SIZES }, 'og:image', 'og-image-is-marketing-card-not-mark');
  }

  degradations.push({ step: 'favicon-extract', reason: 'absent-in-source' });
  return noneField('absent-in-source', '--logo <path>');
}
