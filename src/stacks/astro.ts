// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import type React from 'react';
import type { StackRuntime } from './index.js';
import { buildStackPreviewDocument, escapeHtml, htmlDocument, stackPreviewLabel, stackPreviewMeta, STACK_PREVIEW_VERSION } from './preview-html.js';

function islandMarkup(ids: readonly string[]): string {
  const safeIds = ids.length > 0 ? ids : ['vbrand-preview-island'];
  return safeIds.map((id) => `<astro-island uid="${escapeHtml(id)}" component-export="default" client="load"></astro-island><script type="application/json" data-astro-component-hydration data-island-id="${escapeHtml(id)}">{"client":"load"}</script>`).join('');
}

export const astroRuntime: StackRuntime = {
  name: () => 'astro',
  defaultMode: () => 'static',
  bootstrapMarkup(composed: React.ReactNode): string {
    const preview = buildStackPreviewDocument(composed);
    const shape = 'Astro island preview shape, not a live Astro build';
    const meta = stackPreviewMeta({ stack: 'astro', version: STACK_PREVIEW_VERSION, artefact: 'dist/stacks/astro.html', shape });
    return htmlDocument('vBrand Astro preview', `<main data-vbrand-stack="astro" data-astro-static-shell="true">${preview.bodyHtml}</main>${meta}${islandMarkup(preview.islandIds)}${stackPreviewLabel(shape)}`);
  },
};
