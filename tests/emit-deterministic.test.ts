import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runEmit } from '../src/commands/emit.js';
import { hashDir } from '../src/lib/hash.js';
import { SCHEMA_FILENAME } from '../src/schema.js';

async function createWorkspace(overrides: Partial<{
  faviconSizes: number[];
  iconSet: string[];
  colors: Record<string, string>;
}> = {}): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), 'vbrand-det-'));

  await sharp({
    create: { width: 512, height: 512, channels: 4, background: { r: 99, g: 102, b: 241, alpha: 255 } },
  }).png().toFile(join(dir, 'logo.png'));

  await sharp({
    create: { width: 1200, height: 630, channels: 3, background: { r: 15, g: 23, b: 42 } },
  }).png().toFile(join(dir, 'og-source.png'));

  const schema = {
    name: 'det-test',
    voice: { canonical: 'Test.', repoDescription: 'Determinism test.' },
    assets: {
      favicon: { source: 'logo.png', sizes: overrides.faviconSizes ?? [16, 32] },
      og: { source: 'og-source.png', dimensions: [1200, 630] },
      icons: { source: 'icons/', set: overrides.iconSet ?? [] },
    },
    tokens: {
      color: overrides.colors ?? { primary: '#000000' },
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

const dirs: string[] = [];

afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

describe('emit determinism - favicon + OG + swatches', () => {
  it('two consecutive runs produce byte-equal trees for base schema', async () => {
    const dir = await createWorkspace();
    dirs.push(dir);

    await runEmit({ cwd: dir });
    const h1 = new Map(hashDir(join(dir, 'public', 'brand')));

    await runEmit({ cwd: dir });
    const h2 = hashDir(join(dir, 'public', 'brand'));

    assertByteEqual(h1, h2);
  });

  it('is deterministic with larger favicon size set', async () => {
    const dir = await createWorkspace({ faviconSizes: [16, 32, 64, 180, 512] });
    dirs.push(dir);

    await runEmit({ cwd: dir });
    const h1 = new Map(hashDir(join(dir, 'public', 'brand')));

    await runEmit({ cwd: dir });
    const h2 = hashDir(join(dir, 'public', 'brand'));

    assertByteEqual(h1, h2);
  });

  it('is deterministic with multiple color tokens', async () => {
    const dir = await createWorkspace({
      colors: { primary: '#0f172a', accent: '#6366f1', background: '#ffffff', surface: '#f8fafc' },
    });
    dirs.push(dir);

    await runEmit({ cwd: dir });
    const h1 = new Map(hashDir(join(dir, 'public', 'brand')));

    await runEmit({ cwd: dir });
    const h2 = hashDir(join(dir, 'public', 'brand'));

    assertByteEqual(h1, h2);
  });
});

describe('emit determinism - with icon set', () => {
  beforeAll(async () => {});

  it('is deterministic when icons set is non-empty', async () => {
    const dir = await createWorkspace({ iconSet: ['menu', 'close', 'arrow-right'] });
    dirs.push(dir);

    const iconsDir = join(dir, 'icons');
    const { mkdirSync } = await import('node:fs');
    mkdirSync(iconsDir);

    for (const name of ['menu', 'close', 'arrow-right']) {
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
