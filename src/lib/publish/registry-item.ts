// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ensureDir } from '../fs.js';
import { VbrandType } from '../../schema.js';

export interface RegistryItemFile {
  path: string;
  type: 'registry:file';
  target?: string;
}

export interface RegistryItem {
  $schema: string;
  name: string;
  type: 'registry:brand';
  title: string;
  description: string;
  category: 'brand';
  version: string;
  files: RegistryItemFile[];
  meta: {
    brandName: string;
    primaryColor: string;
    themeColor: string;
    faviconSizes: number[];
    ogDimensions: [number, number];
  };
}

const REGISTRY_SCHEMA_URL =
  'https://ui.shadcn.com/schema/registry-item.json';

export function buildRegistryItem(schema: VbrandType, version: string): RegistryItem {
  const id = schema.name.toLowerCase().replace(/\s+/g, '-');
  const [w, h] = schema.assets.og.dimensions;

  const files: RegistryItemFile[] = [
    { path: 'vbrand.schema.json', type: 'registry:file', target: 'vbrand.schema.json' },
    { path: 'public/brand/manifest.webmanifest', type: 'registry:file' },
    { path: 'public/brand/brand-tokens.css', type: 'registry:file' },
    { path: 'public/brand/DESIGN.md', type: 'registry:file' },
    { path: 'public/brand/og.png', type: 'registry:file' },
    ...schema.assets.favicon.sizes.map((size) => ({
      path: `public/brand/favicons/favicon-${size}.png`,
      type: 'registry:file' as const,
    })),
  ];

  return {
    $schema: REGISTRY_SCHEMA_URL,
    name: `brand:${id}`,
    type: 'registry:brand',
    title: schema.name,
    description: schema.voice.repoDescription,
    category: 'brand',
    version,
    files,
    meta: {
      brandName: schema.name,
      primaryColor: schema.tokens.color['primary'] ?? '#000000',
      themeColor: schema.tokens.color['primary'] ?? '#000000',
      faviconSizes: [...schema.assets.favicon.sizes].sort((a, b) => a - b),
      ogDimensions: [w, h],
    },
  };
}

export function writeRegistryItem(
  schema: VbrandType,
  version: string,
  distDir: string,
): string {
  ensureDir(distDir);
  const item = buildRegistryItem(schema, version);
  const outPath = join(distDir, 'registry-item.json');
  writeFileSync(outPath, JSON.stringify(item, null, 2) + '\n', 'utf-8');
  return outPath;
}
