// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko

import { parse as parseHtml } from 'node-html-parser';
import { stripTitleTrailer } from './voice-text.js';
import { normalizeHex } from './color-value.js';
import { flattenJsonLdNodes, extractJsonLdSignals } from './json-ld.js';
import { extractInlineStyleColors } from './inline-style-colors.js';

export interface PageSignals {
  name: string;
  nameSource: 'og:site_name' | 'og:title' | 'title' | 'hostname';
  ogTitle: string | undefined;
  titleText: string | undefined;
  ogDescription: string | undefined;
  metaDescription: string | undefined;
  jsonLdOrgName: string | undefined;
  jsonLdDescription: string | undefined;
  themeColors: string[];
  jsonLdColors: string[];
  inlineStyleColors: string[];
  faviconUrl: string | undefined;
  logoUrl: string | undefined;
  ogImageUrl: string | undefined;
}

function resolveUrl(href: string, base: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

function metaContent(root: ReturnType<typeof parseHtml>, selector: string): string | undefined {
  const raw = root.querySelector(selector)?.getAttribute('content')?.trim();
  return raw && raw.length > 0 ? raw : undefined;
}

export function extractPageSignals(html: string, pageUrl: string): PageSignals {
  const root = parseHtml(html, { comment: false });
  const hostname = new URL(pageUrl).hostname;

  const ogSiteName = metaContent(root, 'meta[property="og:site_name"]');
  const ogTitle    = metaContent(root, 'meta[property="og:title"]');
  const titleText  = root.querySelector('title')?.text.trim() || undefined;

  let name: string;
  let nameSource: PageSignals['nameSource'];
  if (ogSiteName) {
    name = ogSiteName; nameSource = 'og:site_name';
  } else if (ogTitle) {
    name = stripTitleTrailer(ogTitle); nameSource = 'og:title';
  } else if (titleText) {
    name = stripTitleTrailer(titleText) || hostname; nameSource = 'title';
  } else {
    name = hostname; nameSource = 'hostname';
  }

  const ogDescription   = metaContent(root, 'meta[property="og:description"]');
  const metaDescription = metaContent(root, 'meta[name="description"]');

  const jsonLdNodes = flattenJsonLdNodes(root);
  const jsonLd      = extractJsonLdSignals(jsonLdNodes);

  const rawThemeColor = metaContent(root, 'meta[name="theme-color"]');
  const themeColors: string[] = rawThemeColor
    ? (normalizeHex(rawThemeColor) ? [normalizeHex(rawThemeColor)!] : [])
    : [];

  const jsonLdColors: string[] = jsonLd.brandColor ? [jsonLd.brandColor] : [];
  const inlineStyleColors = extractInlineStyleColors(root);

  const faviconEl =
    root.querySelector('link[rel="icon"]') ??
    root.querySelector('link[rel="shortcut icon"]') ??
    root.querySelector('link[rel="apple-touch-icon"]');
  const faviconHref = faviconEl?.getAttribute('href');
  const faviconUrl  = faviconHref ? resolveUrl(faviconHref, pageUrl) : undefined;

  const logoEl =
    root.querySelector('img[alt*="logo" i]') ??
    root.querySelector('img[class*="logo" i]') ??
    root.querySelector('img[id*="logo" i]');
  const logoSrc = logoEl?.getAttribute('src');
  const logoUrl = logoSrc ? resolveUrl(logoSrc, pageUrl) : undefined;

  const ogImageContent = metaContent(root, 'meta[property="og:image"]');
  const ogImageUrl     = ogImageContent ? resolveUrl(ogImageContent, pageUrl) : undefined;

  return {
    name, nameSource,
    ogTitle, titleText,
    ogDescription, metaDescription,
    jsonLdOrgName:    jsonLd.orgName,
    jsonLdDescription: jsonLd.description,
    themeColors, jsonLdColors, inlineStyleColors,
    faviconUrl, logoUrl, ogImageUrl,
  };
}
