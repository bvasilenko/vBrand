// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

export interface IslandEntry {
  readonly id: string;
  readonly selector: string;
  readonly propsHash: string;
}

export type IslandManifest = readonly IslandEntry[];

export type IslandRegistry = Readonly<Record<string, React.ReactNode>>;

export interface IslandQueryContext {
  querySelector: (selector: string) => Element | null;
}

let _captureRegistry: Map<string, React.ReactNode> | null = null;

interface IslandMarkerProps {
  id: string;
  children?: React.ReactNode;
}

function IslandMarker({ id, children }: IslandMarkerProps): React.ReactElement {
  _captureRegistry?.set(id, children);
  return React.createElement('div', { 'data-island': id }, children);
}

export function markIsland(node: React.ReactNode, id: string): React.ReactElement {
  _captureRegistry?.set(id, node);
  return React.createElement(IslandMarker, { id, key: id }, node);
}

export function withIslandCapture<T>(
  fn: () => T,
): { result: T; getIslandComponent: (id: string) => React.ReactNode; registry: IslandRegistry } {
  _captureRegistry = new Map();
  try {
    const result = fn();
    const snapshot = new Map(_captureRegistry);
    const registry = Object.fromEntries(snapshot) as IslandRegistry;
    return { result, getIslandComponent: (id) => snapshot.get(id) ?? null, registry };
  } finally {
    _captureRegistry = null;
  }
}

export function buildIslandRegistry(tree: React.ReactNode): IslandRegistry {
  const { registry } = withIslandCapture(() =>
    renderToStaticMarkup(tree as React.ReactElement),
  );
  return registry;
}

export function collectIslands(html: string): IslandManifest {
  const pattern = /data-island="([^"]+)"/g;
  const manifest: IslandEntry[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const id = match[1]!;
    if (!seen.has(id)) {
      seen.add(id);
      manifest.push({ id, selector: `[data-island="${id}"]`, propsHash: '' });
    }
  }
  return manifest;
}

export async function hydrateIslands(
  manifest: IslandManifest,
  getComponent: (id: string) => React.ReactNode,
  doc: IslandQueryContext = document,
): Promise<void> {
  if (manifest.length === 0) return;
  const { hydrateRoot } = await import('react-dom/client');
  for (const entry of manifest) {
    const el = doc.querySelector(entry.selector);
    if (el !== null) {
      hydrateRoot(el, getComponent(entry.id));
    }
  }
}
