// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import type React from 'react';
import type { StackRuntime } from './index.js';
import { buildStackPreviewDocument, escapeScriptJson, htmlDocument, stackPreviewLabel, stackPreviewMeta, STACK_PREVIEW_VERSION } from './preview-html.js';

export const viteRuntime: StackRuntime = {
  name: () => 'vite',
  defaultMode: () => 'spa',
  bootstrapMarkup(composed: React.ReactNode): string {
    const preview = buildStackPreviewDocument(composed);
    const payload = escapeScriptJson(JSON.stringify({ stack: 'vite', textContent: preview.textContent }));
    const shape = 'Vite SPA bootstrap preview shape, not a live Vite dev server or full hydration runtime';
    const meta = stackPreviewMeta({ stack: 'vite', version: STACK_PREVIEW_VERSION, artefact: 'dist/stacks/vite.html', shape });
    return htmlDocument('vBrand Vite preview', `<main id="root" data-vbrand-stack="vite">${preview.bodyHtml}</main>${meta}<script type="application/json" id="__VBRAND_STACK_PREVIEW__">${payload}</script><script type="application/json" id="__VBRAND_VITE_BOOTSTRAP_PREVIEW__">{"boundary":"spa-bootstrap-preview"}</script>${stackPreviewLabel(shape)}`);
  },
};
