// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { collectIslands } from '../interactivity/islands.js';

export interface StackPreviewDocument {
  readonly bodyHtml: string;
  readonly textContent: string;
  readonly islandIds: readonly string[];
}

export interface StackPreviewMeta {
  readonly stack: string;
  readonly version: string;
  readonly artefact: string;
  readonly shape: string;
}

declare const __VBRAND_VERSION__: string;
export const STACK_PREVIEW_VERSION: string = __VBRAND_VERSION__;

export function buildStackPreviewDocument(composed: React.ReactNode): StackPreviewDocument {
  const bodyHtml = renderToStaticMarkup(React.createElement(React.Fragment, null, composed));
  const textContent = bodyHtml.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return { bodyHtml, textContent, islandIds: collectIslands(bodyHtml).map((island) => island.id) };
}

export function htmlDocument(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head><body>${body}</body></html>`;
}

export function stackPreviewMeta(meta: StackPreviewMeta): string {
  return `<script type="application/json" id="__VBRAND_STACK_ARTEFACT__">${escapeScriptJson(JSON.stringify(meta))}</script>`;
}

export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function escapeScriptJson(value: string): string {
  return value.replace(/</g, '\\u003c');
}

export function stackPreviewLabel(shape: string): string {
  return `<footer data-stack-preview-label style="position:fixed;bottom:0;left:0;right:0;padding:3px 10px;background:rgba(0,0,0,0.72);color:#e5e7eb;font-size:10px;font-family:monospace;z-index:9999;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(shape)}</footer>`;
}
