// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { join } from 'node:path';
import { parse as parseHtml } from 'node-html-parser';
import {
  CandidateDoc,
  CandidateFields,
  DegradationEntry,
  AssetProvenance,
} from './candidate-schema.js';
import {
  CandidateField,
  highField,
  mediumField,
  lowField,
  noneField,
} from './confidence.js';
import { sourceToSlug } from './slug.js';
import { buildCandidateDoc, emptyFields } from './candidate.js';
import { cacheAsset } from './asset-cache.js';

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const DEFAULT_FAVICON_SIZES: [number, ...number[]] = [16, 32, 180, 512];
const DEFAULT_OG_DIMENSIONS: [number, number] = [1200, 630];

interface PageSignals {
  name: string;
  nameSource: 'og:site_name' | 'og:title' | 'title' | 'hostname';
  themeColors: string[];
  faviconUrl: string | undefined;
  logoUrl: string | undefined;
  ogImageUrl: string | undefined;
}

function normalizeHex(raw: string): string | undefined {
  const t = raw.trim();
  return HEX_RE.test(t) ? t : undefined;
}

function resolveUrl(href: string, base: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

function extractPageSignals(html: string, pageUrl: string): PageSignals {
  const root = parseHtml(html, { comment: false });

  const ogSiteName = root
    .querySelector('meta[property="og:site_name"]')
    ?.getAttribute('content');
  const ogTitle = root
    .querySelector('meta[property="og:title"]')
    ?.getAttribute('content');
  const titleText = root.querySelector('title')?.text.trim();
  const hostname = new URL(pageUrl).hostname;

  let name: string;
  let nameSource: PageSignals['nameSource'];
  if (ogSiteName?.trim()) {
    name = ogSiteName.trim();
    nameSource = 'og:site_name';
  } else if (ogTitle?.trim()) {
    name = ogTitle.split(/[|\-–—]/)[0]?.trim() ?? ogTitle;
    nameSource = 'og:title';
  } else if (titleText) {
    name = titleText.split(/[|\-–—]/)[0]?.trim() || hostname;
    nameSource = 'title';
  } else {
    name = hostname;
    nameSource = 'hostname';
  }

  const themeColors: string[] = [];
  const themeColorContent = root
    .querySelector('meta[name="theme-color"]')
    ?.getAttribute('content');
  if (themeColorContent) {
    const hex = normalizeHex(themeColorContent);
    if (hex) themeColors.push(hex);
  }

  const faviconEl =
    root.querySelector('link[rel="icon"]') ??
    root.querySelector('link[rel="shortcut icon"]') ??
    root.querySelector('link[rel="apple-touch-icon"]');
  const faviconHref = faviconEl?.getAttribute('href');
  const faviconUrl = faviconHref ? resolveUrl(faviconHref, pageUrl) : undefined;

  const logoEl =
    root.querySelector('img[alt*="logo" i]') ??
    root.querySelector('img[class*="logo" i]') ??
    root.querySelector('img[id*="logo" i]');
  const logoSrc = logoEl?.getAttribute('src');
  const logoUrl = logoSrc ? resolveUrl(logoSrc, pageUrl) : undefined;

  const ogImageContent = root
    .querySelector('meta[property="og:image"]')
    ?.getAttribute('content');
  const ogImageUrl = ogImageContent ? resolveUrl(ogImageContent, pageUrl) : undefined;

  return { name, nameSource, themeColors, faviconUrl, logoUrl, ogImageUrl };
}

function buildNameField(signals: PageSignals): CandidateField<string> {
  switch (signals.nameSource) {
    case 'og:site_name':
      return highField(signals.name, 'og:site_name');
    case 'og:title':
      return mediumField(signals.name, 'og:title');
    case 'title':
      return mediumField(signals.name, 'title');
    case 'hostname':
      return lowField(signals.name, 'hostname', 'no-name-meta');
  }
}

function buildColorsField(signals: PageSignals): CandidateField<Record<string, string>> {
  if (signals.themeColors.length === 0) return noneField('absent-in-source');
  const colorMap: Record<string, string> = {};
  signals.themeColors.forEach((hex, i) => {
    colorMap[i === 0 ? 'primary' : `color-${i}`] = hex;
  });
  return highField(colorMap, 'theme-color-meta');
}

async function buildFaviconField(
  signals: PageSignals,
  cacheDir: string,
  degradations: DegradationEntry[],
  assets: AssetProvenance[],
): Promise<CandidateField<{ source: string; sizes: number[] }>> {
  const candidateUrl = signals.faviconUrl ?? signals.logoUrl;

  if (candidateUrl) {
    const { result, degradation } = await cacheAsset(candidateUrl, cacheDir, 'favicon');
    if (degradation) degradations.push(degradation);
    if (result.kind === 'hit') {
      assets.push({ field: 'assets.favicon', sourceUrl: candidateUrl, localPath: result.localPath });
      const source = signals.faviconUrl ? 'link[rel=icon]' : 'img[alt*=logo]';
      const confidence = signals.faviconUrl ? ('high' as const) : ('medium' as const);
      return {
        value: { source: result.localPath, sizes: DEFAULT_FAVICON_SIZES },
        confidence,
        source,
      };
    }
    return noneField('download-failed', '--logo <path>');
  }

  if (signals.ogImageUrl) {
    degradations.push({
      step: 'favicon-extract',
      reason: 'og-image-is-marketing-card-not-mark',
    });
    return lowField(
      { source: signals.ogImageUrl, sizes: DEFAULT_FAVICON_SIZES },
      'og:image',
      'og-image-is-marketing-card-not-mark',
    );
  }

  return noneField('absent-in-source', '--logo <path>');
}

export async function fetchFromUrl(url: string, cacheBase?: string): Promise<CandidateDoc> {
  const slug = sourceToSlug(url);
  const degradations: DegradationEntry[] = [];
  const assets: AssetProvenance[] = [];

  let html: string;
  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'vbrand/0.2.0' } });

    if (response.status === 403 || response.status === 429) {
      degradations.push({
        step: 'fetch',
        reason: 'blocked-on-fetch',
        detail: `HTTP ${response.status}`,
      });
      return buildCandidateDoc(slug, url, emptyFields(), degradations, assets);
    }

    if (!response.ok) {
      degradations.push({
        step: 'fetch',
        reason: 'source-unreachable',
        detail: `HTTP ${response.status}`,
      });
      return buildCandidateDoc(slug, url, emptyFields(), degradations, assets);
    }

    html = await response.text();
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    degradations.push({ step: 'fetch', reason: 'source-unreachable', detail });
    return buildCandidateDoc(slug, url, emptyFields(), degradations, assets);
  }

  const signals = extractPageSignals(html, url);
  const cacheDir = cacheBase ? join(cacheBase, slug) : join('/tmp/vbrand-cache', slug);

  const faviconField = cacheBase !== undefined
    ? await buildFaviconField(signals, cacheDir, degradations, assets)
    : signals.faviconUrl
      ? lowField(
          { source: signals.faviconUrl, sizes: DEFAULT_FAVICON_SIZES },
          'link[rel=icon]',
          'not-cached',
        )
      : noneField<{ source: string; sizes: number[] }>('absent-in-source', '--logo <path>');

  const fields: CandidateFields = {
    ...emptyFields(),
    name:             buildNameField(signals),
    colors:           buildColorsField(signals),
    favicon:          faviconField,
    og:               highField({ dimensions: DEFAULT_OG_DIMENSIONS }, 'default'),
    icons:            noneField('absent-in-source'),
  };

  return buildCandidateDoc(slug, url, fields, degradations, assets);
}
