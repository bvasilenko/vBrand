// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { BrowserBrandSourceAdapter } from '@booga/vbrand/adapters/browser';
import type { VbrandType } from '@booga/vbrand/adapters/browser';
import type { BrandParams } from './router';

const adapter = new BrowserBrandSourceAdapter();

// Demo-local fallback palette applied when the loaded brand carries no
// `tokens.color` entries. Surfaces a "color fallback active" badge in the
// data view so the visitor sees the degradation honestly. Per template-view
// option B for the 0.4.0-alpha.2 colors-extract dynamic-render-required
// degradation: cheaper than re-publishing a vfixtures patch when a non-stripe
// brand source has empty tokens.color.
const FALLBACK_PALETTE: Record<string, string> = {
  primary: '#6366f1',
  secondary: '#0a2540',
  accent: '#00d4ff',
  'neutral-50': '#f9fafb',
  'neutral-100': '#f3f4f6',
  'neutral-200': '#e5e7eb',
  'neutral-500': '#6b7280',
  'neutral-700': '#374151',
  'neutral-900': '#111827',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
};

// Bundled relative-path overrides applied per-fixture so the data view shows
// a gh-pages-resolvable asset URL instead of a live upstream URL. Each entry
// resolves against vite's `base` (e.g. `/vBrand/assets/stripe-com/favicon.svg`).
// Adds bug-1 honest-rendering of the favicon source string.
const BUNDLED_FAVICON: Record<string, { source: string; sizes: number[] }> = {
  stripe: { source: 'assets/stripe-com/favicon.svg', sizes: [16, 32, 180, 512] },
};

export interface BrandLoadResult {
  brand: VbrandType;
  meta: BrandMeta;
}

export interface BrandMeta {
  colorFallbackActive: boolean;
  faviconBundled: boolean;
}

export async function loadBrand(params: BrandParams): Promise<BrandLoadResult> {
  const brand = await loadBrandRaw(params);
  return applyDemoOverlay(brand, params);
}

function loadBrandRaw(params: BrandParams): Promise<VbrandType> {
  switch (params.type) {
    case 'fixture':     return adapter.loadFromFixture(params.handle);
    case 'url':         return adapter.loadFromUrl(params.url);
    case 'github':      return adapter.loadFromGitHub(params.owner, params.repo);
    case 'npm':         return adapter.loadFromNpm(params.pkg);
    case 'json':        return adapter.loadFromCustomJson(params.payload);
    case 'parse-error': return Promise.reject(new Error(params.reason));
  }
}

function applyDemoOverlay(brand: VbrandType, params: BrandParams): BrandLoadResult {
  const meta: BrandMeta = { colorFallbackActive: false, faviconBundled: false };
  let overlay: VbrandType = brand;

  const colorCount = Object.keys(overlay.tokens.color).length;
  if (colorCount === 0) {
    overlay = {
      ...overlay,
      tokens: { ...overlay.tokens, color: { ...FALLBACK_PALETTE } },
    };
    meta.colorFallbackActive = true;
  }

  const bundled = params.type === 'fixture' ? BUNDLED_FAVICON[params.handle] : undefined;
  if (bundled) {
    overlay = {
      ...overlay,
      assets: {
        ...overlay.assets,
        favicon: { source: bundled.source, sizes: [...bundled.sizes] },
      },
    };
    meta.faviconBundled = true;
  }

  return { brand: overlay, meta };
}
