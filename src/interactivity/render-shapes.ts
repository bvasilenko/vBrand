// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { VbrandType } from '../schema.js';
import { getThemedRenderHTML } from '../ssr/themed-render.js';
import { collectIslands, withIslandCapture } from './islands.js';
import type { IslandManifest, IslandRegistry } from './islands.js';

export interface RenderProps {
  readonly brand: VbrandType;
  readonly sections: readonly React.ReactNode[];
}

export interface HybridRenderResult {
  readonly html: string;
  readonly islands: IslandManifest;
  readonly getIslandComponent: (id: string) => React.ReactNode;
  readonly registry: IslandRegistry;
}

export function staticRender(props: RenderProps): string {
  return getThemedRenderHTML(props.brand, props.sections);
}

export function hybridRender(props: RenderProps): HybridRenderResult {
  const { result: html, getIslandComponent, registry } = withIslandCapture(() =>
    getThemedRenderHTML(props.brand, props.sections),
  );
  const islands = collectIslands(html);
  const manifestScript =
    `<script type="application/json" id="__VBRAND_ISLANDS__">` +
    `${JSON.stringify(islands)}</script>`;
  const htmlWithManifest = html.replace('</head>', `${manifestScript}</head>`);
  return { html: htmlWithManifest, islands, getIslandComponent, registry };
}

export function spaRender(tree: React.ReactElement): React.ReactElement {
  return tree;
}

export function renderBodyFragment(sections: readonly React.ReactNode[]): string {
  return renderToStaticMarkup(
    React.createElement(React.Fragment, null, ...sections),
  );
}
