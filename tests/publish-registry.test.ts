// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterAll, describe, expect, it } from 'vitest';
import { runPublish } from '../src/commands/publish.js';
import { runEmit } from '../src/commands/emit.js';
import { buildRegistryItem } from '../src/lib/publish/registry-item.js';
import { buildDtcgBundle, DTCG_EXPERIMENTAL_NOTICE } from '../src/lib/publish/dtcg-bundle.js';
import { SCHEMA_FILENAME, VbrandSchema } from '../src/schema.js';

const dirs: string[] = [];
afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); }, 60000);

const SCHEMA = {
  name: 'My Brand',
  voice: { canonical: 'Terse.', repoDescription: 'Brand bundle.' },
  assets: {
    favicon: { source: 'logo.png', sizes: [16, 32, 512] },
    og: { dimensions: [1200, 630] as [number, number] },
    icons: { source: 'icons/', set: [] },
  },
  tokens: {
    color: { primary: '#0f172a', accent: '#6366f1' },
    type: { sans: 'Inter, sans-serif' },
  },
};

async function createProject(): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), 'vbrand-publish-'));
  dirs.push(dir);
  await sharp({
    create: { width: 512, height: 512, channels: 4, background: { r: 15, g: 23, b: 42, alpha: 255 } },
  }).png().toFile(join(dir, 'logo.png'));
  writeFileSync(join(dir, SCHEMA_FILENAME), JSON.stringify(SCHEMA), 'utf-8');
  await runEmit({ cwd: dir });
  return dir;
}

describe('vbrand publish --as=registry-item (acceptance #23)', () => {
  it('writes dist/registry-item.json', async () => {
    const cwd = await createProject();
    const result = await runPublish({ cwd, as: 'registry-item' });
    expect(result.files.some((f) => f.endsWith('registry-item.json'))).toBe(true);
    expect(existsSync(join(cwd, 'dist', 'registry-item.json'))).toBe(true);
  });

  it('registry-item.json has name brand:<id>', async () => {
    const cwd = await createProject();
    await runPublish({ cwd, as: 'registry-item' });
    const item = JSON.parse(
      readFileSync(join(cwd, 'dist', 'registry-item.json'), 'utf-8'),
    ) as { name: string };
    expect(item.name).toMatch(/^brand:/);
  });

  it('registry-item.json declares category: brand', async () => {
    const schema = VbrandSchema.parse(SCHEMA);
    const item = buildRegistryItem(schema, '0.2.0');
    expect(item.category).toBe('brand');
  });

  it('registry-item.json has type: registry:brand', async () => {
    const schema = VbrandSchema.parse(SCHEMA);
    const item = buildRegistryItem(schema, '0.2.0');
    expect(item.type).toBe('registry:brand');
  });

  it('registry-item.json lists vbrand.schema.json in files', async () => {
    const schema = VbrandSchema.parse(SCHEMA);
    const item = buildRegistryItem(schema, '0.2.0');
    expect(item.files.some((f) => f.path === 'vbrand.schema.json')).toBe(true);
  });

  it('registry-item.json lists all favicon sizes in files', async () => {
    const schema = VbrandSchema.parse(SCHEMA);
    const item = buildRegistryItem(schema, '0.2.0');
    for (const size of SCHEMA.assets.favicon.sizes) {
      expect(item.files.some((f) => f.path.includes(`favicon-${size}`))).toBe(true);
    }
  });
});

describe('vbrand publish --as=dtcg (experimental)', () => {
  it('throws without --experimental flag', async () => {
    const cwd = await createProject();
    await expect(runPublish({ cwd, as: 'dtcg' })).rejects.toThrow('--experimental');
  });

  it('writes tokens.dtcg.json with --experimental', async () => {
    const cwd = await createProject();
    const result = await runPublish({ cwd, as: 'dtcg', experimental: true });
    expect(result.files.some((f) => f.endsWith('tokens.dtcg.json'))).toBe(true);
    expect(result.notice).toContain('draft');
  });

  it('DTCG bundle contains color tokens with $type: color', () => {
    const schema = VbrandSchema.parse(SCHEMA);
    const bundle = buildDtcgBundle(schema);
    const primaryToken = bundle['primary'] as { $type: string; $value: string } | undefined;
    expect(primaryToken?.$type).toBe('color');
    expect(primaryToken?.$value).toBe('#0f172a');
  });

  it('DTCG bundle notice references draft URL', () => {
    expect(DTCG_EXPERIMENTAL_NOTICE).toContain('tr.designtokens.org');
  });
});

describe('vbrand publish --as=npm', () => {
  it('writes dist/npm/package.json', async () => {
    const cwd = await createProject();
    const result = await runPublish({ cwd, as: 'npm' });
    expect(result.files.some((f) => f.includes('package.json'))).toBe(true);
    expect(existsSync(join(cwd, 'dist', 'npm', 'package.json'))).toBe(true);
  });

  it('dist/npm/package.json has valid name and version', async () => {
    const cwd = await createProject();
    await runPublish({ cwd, as: 'npm' });
    const pkg = JSON.parse(
      readFileSync(join(cwd, 'dist', 'npm', 'package.json'), 'utf-8'),
    ) as { name: string; version: string };
    expect(pkg.name).toMatch(/@booga\/brand-/);
    expect(pkg.version).toBeDefined();
  });

  it('dist/npm/ includes README.md and LICENSE', async () => {
    const cwd = await createProject();
    await runPublish({ cwd, as: 'npm' });
    expect(existsSync(join(cwd, 'dist', 'npm', 'README.md'))).toBe(true);
    expect(existsSync(join(cwd, 'dist', 'npm', 'LICENSE'))).toBe(true);
  });
});
