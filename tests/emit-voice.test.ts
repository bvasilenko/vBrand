// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { runEmit } from '../src/commands/emit.js';
import { VoiceProvider } from '../src/lib/voice/provider.js';
import { SCHEMA_FILENAME } from '../src/schema.js';

const dirs: string[] = [];
afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });

const SCHEMA = {
  name: 'voice-test',
  voice: { canonical: 'Terse. Technical.', repoDescription: 'Voice test.' },
  assets: {
    favicon: { source: 'logo.png', sizes: [32] },
    og: { dimensions: [1200, 630] },
    icons: { source: 'icons/', set: [] },
  },
  tokens: { color: { primary: '#0f172a' }, type: {} },
};

async function createWorkspace(): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), 'vbrand-voice-'));
  dirs.push(dir);
  await sharp({
    create: { width: 32, height: 32, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 255 } },
  }).png().toFile(join(dir, 'logo.png'));
  writeFileSync(join(dir, SCHEMA_FILENAME), JSON.stringify(SCHEMA), 'utf-8');
  return dir;
}

const validVoiceProvider: VoiceProvider = {
  generateObject: vi.fn().mockResolvedValue({
    tagline: 'Build fast.',
    shortBio: 'Professional-grade tooling.',
    ogCopy: 'Start building today.',
  }),
};

const schemaViolatingProvider: VoiceProvider = {
  generateObject: vi.fn().mockRejectedValue(
    new Error('ZodError: missing required fields'),
  ),
};

describe('emit --target=voice-samples (acceptance #20)', () => {
  it('calls provider and writes voice-samples.json on valid response', async () => {
    const cwd = await createWorkspace();
    const result = await runEmit({ cwd, target: 'voice-samples', voiceProvider: validVoiceProvider });
    expect(result.files.some((f) => f.includes('voice-samples'))).toBe(true);
    const outPath = join(cwd, 'public', 'brand', 'voice-samples.json');
    expect(existsSync(outPath)).toBe(true);
    const data = JSON.parse(readFileSync(outPath, 'utf-8')) as Record<string, string>;
    expect(data['tagline']).toBe('Build fast.');
  });

  it('exits non-zero (throws) on schema-violation rather than writing partial output', async () => {
    const cwd = await createWorkspace();
    await expect(
      runEmit({ cwd, target: 'voice-samples', voiceProvider: schemaViolatingProvider }),
    ).rejects.toThrow();
  });

  it('throws when no provider is configured', async () => {
    const cwd = await createWorkspace();
    vi.stubEnv('OPENAI_BASE_URL', '');
    vi.stubEnv('OPENAI_API_KEY', '');
    await expect(runEmit({ cwd, target: 'voice-samples' })).rejects.toThrow('provider');
    vi.unstubAllEnvs();
  });
});

describe('emit --target=readme', () => {
  it('writes README-generated.md on valid response', async () => {
    const mockProvider: VoiceProvider = {
      generateObject: vi.fn().mockResolvedValue({
        intro: 'Professional tooling.',
        usage: 'Install and run.',
      }),
    };
    const cwd = await createWorkspace();
    const result = await runEmit({ cwd, target: 'readme', voiceProvider: mockProvider });
    expect(result.files.some((f) => f.includes('README'))).toBe(true);
  });
});

describe('emit --target=og-copy', () => {
  it('writes og-copy.txt on valid response', async () => {
    const mockProvider: VoiceProvider = {
      generateObject: vi.fn().mockResolvedValue({
        title: 'Voice Test',
        description: 'Build tools.',
      }),
    };
    const cwd = await createWorkspace();
    const result = await runEmit({ cwd, target: 'og-copy', voiceProvider: mockProvider });
    expect(result.files.some((f) => f.includes('og-copy'))).toBe(true);
  });
});
