// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import type React from 'react';
import type { StackRuntime } from './index.js';
import { buildStackPreviewDocument, escapeScriptJson, htmlDocument, stackPreviewLabel, stackPreviewMeta, STACK_PREVIEW_VERSION } from './preview-html.js';

export const nextRuntime: StackRuntime = {
  name: () => 'next',
  defaultMode: () => 'hybrid',
  bootstrapMarkup(composed: React.ReactNode): string {
    const preview = buildStackPreviewDocument(composed);
    const pageData = { page: '/vbrand-preview', buildId: 'vbrand-stack-preview', props: { stack: 'next', textContent: preview.textContent, islands: preview.islandIds } };
    const flightPayload = JSON.stringify({ boundary: 'client-hydrate-preview', islands: preview.islandIds });
    const shape = 'Next page-data preview shape, not a live Next server';
    const meta = stackPreviewMeta({ stack: 'next', version: STACK_PREVIEW_VERSION, artefact: 'dist/stacks/next.html', shape });
    return htmlDocument('vBrand Next preview', `<main id="__next" data-vbrand-stack="next">${preview.bodyHtml}</main>${meta}<script id="__NEXT_DATA__" type="application/json">${escapeScriptJson(JSON.stringify(pageData))}</script><script type="application/json" data-next-flight-preview>${escapeScriptJson(JSON.stringify(flightPayload))}</script>${stackPreviewLabel(shape)}`);
  },
};
