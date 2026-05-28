// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { BrandOs, VbrandSchema, SCHEMA_FILENAME } from '../schema.js';
import { emitColorSwatches, emitFavicons, emitIconSet, emitOgImage } from '../lib/image.js';
import { fileExists } from '../lib/fs.js';

export interface EmitOptions {
  cwd?: string;
  schemaPath?: string;
}

export interface EmitResult {
  outDir: string;
  files: string[];
}

function loadSchema(schemaPath: string): BrandOs {
  if (!fileExists(schemaPath)) {
    throw new Error(`Schema not found: ${schemaPath}`);
  }
  const raw = JSON.parse(readFileSync(schemaPath, 'utf-8')) as unknown;
  return VbrandSchema.parse(raw);
}

export async function runEmit(opts: EmitOptions = {}): Promise<EmitResult> {
  const cwd = opts.cwd ?? process.cwd();
  const schemaPath = opts.schemaPath ?? join(cwd, SCHEMA_FILENAME);
  const schema = loadSchema(schemaPath);
  const outDir = join(cwd, 'public', 'brand');
  const schemaDir = dirname(schemaPath);

  const faviconSource = resolve(schemaDir, schema.assets.favicon.source);
  const ogSource = resolve(schemaDir, schema.assets.og.source);
  const iconsSource = resolve(schemaDir, schema.assets.icons.source);

  await emitFavicons(faviconSource, schema.assets.favicon.sizes, join(outDir, 'favicons'));
  await emitOgImage(ogSource, schema.assets.og.dimensions, outDir);
  await emitColorSwatches(schema.tokens.color, outDir);
  await emitIconSet(iconsSource, schema.assets.icons.set, join(outDir, 'icons'));

  const files = [
    ...schema.assets.favicon.sizes.map((s) => `public/brand/favicons/favicon-${s}.png`),
    'public/brand/og.png',
    'public/brand/swatches.json',
    ...schema.assets.icons.set.map((n) => `public/brand/icons/${n}.svg`),
  ].sort();

  return { outDir, files };
}
