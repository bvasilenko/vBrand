// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { VbrandSchema, type VbrandType } from '../../schema.js';
import { buildBaselinePartial } from '../../lib/baseline/partial-builder.js';

export function extractBrandFromHtml(html: string, sourceUrl: string): VbrandType {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const baseline = buildBaselinePartial();

  const ogTitle = metaContent(doc, 'property', 'og:title');
  const ogDescription = metaContent(doc, 'property', 'og:description');
  const description = metaContent(doc, 'name', 'description');
  const themeColor = metaContent(doc, 'name', 'theme-color');
  const faviconHref = resolveHref(
    doc.querySelector('link[rel~="icon"]')?.getAttribute('href') ?? null,
    sourceUrl,
  );

  const name = ogTitle ?? doc.title ?? new URL(sourceUrl).hostname;
  const canonical = ogDescription ?? description ?? name;

  return VbrandSchema.parse({
    ...baseline,
    name,
    voice: { canonical, repoDescription: description ?? canonical },
    assets: {
      favicon: {
        source: faviconHref ?? `${origin(sourceUrl)}/favicon.ico`,
        sizes: baseline.assets.favicon.sizes,
      },
      og: { dimensions: baseline.assets.og.dimensions },
      icons: {
        source: sourceUrl,
        set: faviconHref ? [faviconHref] : baseline.assets.icons.set,
      },
    },
    tokens: {
      color: themeColor
        ? { ...baseline.tokens.color, primary: themeColor }
        : baseline.tokens.color,
      type: baseline.tokens.type,
    },
  });
}

function metaContent(doc: Document, attr: string, value: string): string | null {
  return (
    doc
      .querySelector(`meta[${attr}="${value}"]`)
      ?.getAttribute('content') ?? null
  );
}

function resolveHref(href: string | null, base: string): string | null {
  if (!href) return null;
  try {
    return new URL(href, base).href;
  } catch {
    return null;
  }
}

function origin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}
