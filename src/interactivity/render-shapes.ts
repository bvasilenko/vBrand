// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { collectIslands } from './islands.js';
import type { IslandManifest } from './islands.js';

export interface HybridRenderResult {
  readonly html: string;
  readonly islands: IslandManifest;
}

export function staticRender(tree: React.ReactElement): string {
  return renderToStaticMarkup(tree);
}

export function hybridRender(tree: React.ReactElement): HybridRenderResult {
  const html = renderToStaticMarkup(tree);
  return { html, islands: collectIslands(html) };
}

export function spaRender(tree: React.ReactElement): React.ReactElement {
  return tree;
}
