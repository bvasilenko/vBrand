// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterAll, describe, expect, it } from 'vitest';
import { runEmit } from '../src/commands/emit.js';
import { hashDir } from '../src/lib/hash.js';
import { SCHEMA_FILENAME } from '../src/schema.js';

const dirs: string[] = [];
afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });

async function createWorkspace(overrides: Partial<{
  faviconSizes: number[];
  iconSet: string[];
  colors: Record<string, string>;
}> = {}): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), 'vbrand-det-'));
  dirs.push(dir);

  await sharp({
    create: { width: 512, height: 512, channels: 4, background: { r: 99, g: 102, b: 241, alpha: 255 } },
  }).png().toFile(join(dir, 'logo.png'));

  const schema = {
    name: 'det-test',
    voice: { canonical: 'Determinism.', repoDescription: 'Determinism test.' },
    assets: {
      favicon: { source: 'logo.png', sizes: overrides.faviconSizes ?? [16, 32] },
      og: { dimensions: [1200, 630] },
      icons: { source: 'icons/', set: overrides.iconSet ?? [] },
    },
    tokens: {
      color: overrides.colors ?? { primary: '#6366f1' },
      type: { sans: 'Inter, sans-serif' },
    },
  };
  writeFileSync(join(dir, SCHEMA_FILENAME), JSON.stringify(schema, null, 2), 'utf-8');
  return dir;
}

function assertByteEqual(map1: Map<string, string>, map2: Map<string, string>): void {
  expect(map1.size).toBeGreaterThan(0);
  expect(map1.size).toBe(map2.size);
  for (const [file, hash] of map1) {
    expect(map2.get(file), `hash mismatch: ${file}`).toBe(hash);
  }
}

describe('emit determinism - core outputs (acceptance #19)', () => {
  it('two consecutive runs produce byte-equal trees', async () => {
    const dir = await createWorkspace();
    await runEmit({ cwd: dir });
    const h1 = new Map(hashDir(join(dir, 'public', 'brand')));
    await runEmit({ cwd: dir });
    const h2 = hashDir(join(dir, 'public', 'brand'));
    assertByteEqual(h1, h2);
  });

  it('manifest.webmanifest is included in output', async () => {
    const dir = await createWorkspace();
    const result = await runEmit({ cwd: dir });
    expect(result.files.some((f) => f.includes('manifest.webmanifest'))).toBe(true);
  });

  it('brand-tokens.css is included in output', async () => {
    const dir = await createWorkspace();
    const result = await runEmit({ cwd: dir });
    expect(result.files.some((f) => f.includes('brand-tokens.css'))).toBe(true);
  });

  it('DESIGN.md is included in output', async () => {
    const dir = await createWorkspace();
    const result = await runEmit({ cwd: dir });
    expect(result.files.some((f) => f.includes('DESIGN.md'))).toBe(true);
  });

  it('og.png is generated via Satori (schema-driven)', async () => {
    const dir = await createWorkspace();
    const result = await runEmit({ cwd: dir });
    expect(result.files.some((f) => f.includes('og.png'))).toBe(true);
  });

  it('is deterministic with multiple favicon sizes', async () => {
    const dir = await createWorkspace({ faviconSizes: [16, 32, 64, 180, 512] });
    await runEmit({ cwd: dir });
    const h1 = new Map(hashDir(join(dir, 'public', 'brand')));
    await runEmit({ cwd: dir });
    const h2 = hashDir(join(dir, 'public', 'brand'));
    assertByteEqual(h1, h2);
  });

  it('is deterministic with multiple color tokens', async () => {
    const dir = await createWorkspace({
      colors: { primary: '#0f172a', accent: '#6366f1', background: '#ffffff' },
    });
    await runEmit({ cwd: dir });
    const h1 = new Map(hashDir(join(dir, 'public', 'brand')));
    await runEmit({ cwd: dir });
    const h2 = hashDir(join(dir, 'public', 'brand'));
    assertByteEqual(h1, h2);
  });
});

describe('emit determinism - with icon set', () => {
  it('is deterministic when icons set is non-empty', async () => {
    const dir = await createWorkspace({ iconSet: ['menu', 'close'] });
    const iconsDir = join(dir, 'icons');
    mkdirSync(iconsDir);
    for (const name of ['menu', 'close']) {
      writeFileSync(
        join(iconsDir, `${name}.svg`),
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>`,
        'utf-8',
      );
    }
    await runEmit({ cwd: dir });
    const h1 = new Map(hashDir(join(dir, 'public', 'brand')));
    await runEmit({ cwd: dir });
    const h2 = hashDir(join(dir, 'public', 'brand'));
    assertByteEqual(h1, h2);
  });
});
