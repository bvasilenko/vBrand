// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ensureDir } from '../fs.js';
import { VbrandType } from '../../schema.js';

interface WebAppManifest {
  name: string;
  short_name: string;
  description: string;
  theme_color: string;
  background_color: string;
  display: string;
  icons: Array<{ src: string; sizes: string; type: string; purpose: string }>;
}

export function emitManifest(schema: VbrandType, outDir: string): string {
  ensureDir(outDir);

  const primaryColor = schema.tokens.color['primary'] ?? '#000000';
  const bgColor = schema.tokens.color['background'] ?? '#ffffff';

  const faviconSizes = [...schema.assets.favicon.sizes].sort((a, b) => a - b);
  const icons = faviconSizes.map((size) => ({
    src: `favicons/favicon-${size}.png`,
    sizes: `${size}x${size}`,
    type: 'image/png',
    purpose: size >= 512 ? 'any maskable' : 'any',
  }));

  const manifest: WebAppManifest = {
    name: schema.name,
    short_name: schema.name.split(/\s+/)[0] ?? schema.name,
    description: schema.voice.repoDescription,
    theme_color: primaryColor,
    background_color: bgColor,
    display: 'standalone',
    icons,
  };

  const outPath = join(outDir, 'manifest.webmanifest');
  writeFileSync(outPath, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
  return outPath;
}
