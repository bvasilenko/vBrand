// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { dirname, join, resolve } from 'node:path';
import { VbrandType, SCHEMA_FILENAME } from '../schema.js';
import { loadSchema } from '../lib/schema-io.js';
import { emitFavicons, emitColorSwatches, emitIconSet } from '../lib/image.js';
import { emitOgSatori } from '../lib/emit/og-satori.js';
import { emitManifest } from '../lib/emit/manifest.js';
import { emitCssVars } from '../lib/emit/css-vars.js';
import { emitDesignDoc } from '../lib/emit/design-doc.js';
import { VoiceProvider, createVoiceProviderFromEnv } from '../lib/voice/provider.js';
import { writeFileSync } from 'node:fs';
import { ensureDir } from '../lib/fs.js';

export type EmitTarget = 'public/brand' | 'voice-samples' | 'readme' | 'og-copy';

export interface EmitOptions {
  cwd?: string;
  schemaPath?: string;
  target?: EmitTarget;
  voiceProvider?: VoiceProvider;
}

export interface EmitResult {
  outDir: string;
  files: string[];
}

const VOICE_MODEL_DEFAULT = 'gpt-4o-mini';

async function emitVoiceSamples(
  schema: VbrandType,
  outDir: string,
  provider: VoiceProvider,
): Promise<string[]> {
  const { z } = await import('zod');

  const VoiceSamplesSchema = z.object({
    tagline: z.string().min(1),
    shortBio: z.string().min(1),
    ogCopy: z.string().min(1),
  });

  const canonicalVoice = schema.voice.canonical;
  const system = `You write brand copy in this voice: ${canonicalVoice}. Output JSON only.`;
  const prompt = `Write brand copy for "${schema.name}". Description: ${schema.voice.repoDescription}`;

  const result = await provider.generateObject({
    model: VOICE_MODEL_DEFAULT,
    system,
    prompt,
    schema: VoiceSamplesSchema,
  });

  ensureDir(outDir);
  const outPath = join(outDir, 'voice-samples.json');
  writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n', 'utf-8');
  return [outPath];
}

async function emitReadme(
  schema: VbrandType,
  outDir: string,
  provider: VoiceProvider,
): Promise<string[]> {
  const { z } = await import('zod');

  const ReadmeSchema = z.object({
    intro: z.string().min(1),
    usage: z.string().min(1),
  });

  const result = await provider.generateObject({
    model: VOICE_MODEL_DEFAULT,
    system: `You write technical documentation in this voice: ${schema.voice.canonical}. Output JSON only.`,
    prompt: `Write a README intro and usage section for "${schema.name}"`,
    schema: ReadmeSchema,
  });

  ensureDir(outDir);
  const outPath = join(outDir, 'README-generated.md');
  writeFileSync(
    outPath,
    `# ${schema.name}\n\n${result.intro}\n\n## Usage\n\n${result.usage}\n`,
    'utf-8',
  );
  return [outPath];
}

async function emitOgCopy(
  schema: VbrandType,
  outDir: string,
  provider: VoiceProvider,
): Promise<string[]> {
  const { z } = await import('zod');

  const OgCopySchema = z.object({
    title: z.string().min(1).max(60),
    description: z.string().min(1).max(160),
  });

  const result = await provider.generateObject({
    model: VOICE_MODEL_DEFAULT,
    system: `You write concise OG metadata copy in this voice: ${schema.voice.canonical}. Output JSON only.`,
    prompt: `Write OG title and description for "${schema.name}"`,
    schema: OgCopySchema,
  });

  ensureDir(outDir);
  const outPath = join(outDir, 'og-copy.txt');
  writeFileSync(outPath, `title: ${result.title}\ndescription: ${result.description}\n`, 'utf-8');
  return [outPath];
}

export async function runEmit(opts: EmitOptions = {}): Promise<EmitResult> {
  const cwd = opts.cwd ?? process.cwd();
  const schemaPath = opts.schemaPath ?? join(cwd, SCHEMA_FILENAME);
  const target = opts.target ?? 'public/brand';
  const schema = loadSchema(schemaPath);
  const schemaDir = dirname(schemaPath);

  if (target !== 'public/brand') {
    const provider =
      opts.voiceProvider ?? createVoiceProviderFromEnv();
    if (!provider) {
      throw new Error(
        'Voice target requires a provider. Set OPENAI_BASE_URL + OPENAI_API_KEY or pass voiceProvider option.',
      );
    }
    const voiceOutDir = join(cwd, 'public', 'brand');
    let files: string[];
    switch (target) {
      case 'voice-samples':
        files = await emitVoiceSamples(schema, voiceOutDir, provider);
        break;
      case 'readme':
        files = await emitReadme(schema, voiceOutDir, provider);
        break;
      case 'og-copy':
        files = await emitOgCopy(schema, voiceOutDir, provider);
        break;
    }
    return { outDir: voiceOutDir, files };
  }

  const outDir = join(cwd, 'public', 'brand');

  const faviconSource = resolve(schemaDir, schema.assets.favicon.source);
  const iconsSource = resolve(schemaDir, schema.assets.icons.source);

  await emitFavicons(faviconSource, schema.assets.favicon.sizes, join(outDir, 'favicons'));
  await emitOgSatori(schema, outDir);
  await emitColorSwatches(schema.tokens.color, outDir);
  await emitIconSet(iconsSource, schema.assets.icons.set, join(outDir, 'icons'));
  emitManifest(schema, outDir);
  emitCssVars(schema, outDir);
  emitDesignDoc(schema, outDir);

  const files = [
    ...schema.assets.favicon.sizes.map((s) => `public/brand/favicons/favicon-${s}.png`),
    'public/brand/og.png',
    'public/brand/swatches.json',
    'public/brand/manifest.webmanifest',
    'public/brand/brand-tokens.css',
    'public/brand/DESIGN.md',
    ...schema.assets.icons.set.map((n) => `public/brand/icons/${n}.svg`),
  ].sort();

  return { outDir, files };
}
