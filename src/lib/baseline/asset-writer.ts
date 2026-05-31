// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { ensureDir } from '../fs.js';
import {
  ICONS_SUB_DIR,
  PLACEHOLDER_FAVICON_FILENAME,
  PLACEHOLDER_ICON_FILENAME,
  PLACEHOLDER_SVG,
} from './schema-values.js';

async function writePlaceholderFavicon(cacheDir: string): Promise<void> {
  const dest = join(cacheDir, PLACEHOLDER_FAVICON_FILENAME);
  if (existsSync(dest)) return;
  await sharp({
    create: { width: 1, height: 1, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .png()
    .toFile(dest);
}

function writePlaceholderIcon(iconsDir: string): void {
  const dest = join(iconsDir, PLACEHOLDER_ICON_FILENAME);
  if (existsSync(dest)) return;
  writeFileSync(dest, PLACEHOLDER_SVG, 'utf-8');
}

export async function writeBaselineAssets(cacheDir: string): Promise<void> {
  const iconsDir = join(cacheDir, ICONS_SUB_DIR);
  ensureDir(iconsDir);
  await writePlaceholderFavicon(cacheDir);
  writePlaceholderIcon(iconsDir);
}
