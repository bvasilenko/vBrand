import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runAudit } from '../src/commands/audit.js';
import { runEmit } from '../src/commands/emit.js';
import { SCHEMA_FILENAME } from '../src/schema.js';

const SCHEMA = {
  name: 'audit-test',
  voice: { canonical: 'Test.', repoDescription: 'Audit test.' },
  assets: {
    favicon: { source: 'logo.png', sizes: [16, 32] },
    og: { source: 'og-source.png', dimensions: [1200, 630] as [number, number] },
    icons: { source: 'icons/', set: [] },
  },
  tokens: {
    color: { primary: '#000000', accent: '#ffffff' },
    type: { sans: 'Inter, sans-serif' },
  },
};

async function createProject(): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), 'vbrand-audit-'));

  await sharp({ create: { width: 64, height: 64, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 255 } } })
    .png().toFile(join(dir, 'logo.png'));

  await sharp({ create: { width: 1200, height: 630, channels: 3, background: { r: 0, g: 0, b: 0 } } })
    .png().toFile(join(dir, 'og-source.png'));

  writeFileSync(join(dir, SCHEMA_FILENAME), JSON.stringify(SCHEMA, null, 2), 'utf-8');
  return dir;
}

let cleanDir: string;

beforeAll(async () => {
  cleanDir = await createProject();
  await runEmit({ cwd: cleanDir });
});

afterAll(() => {
  rmSync(cleanDir, { recursive: true, force: true });
});

describe('runAudit - clean state', () => {
  it('returns clean:true when brand surface matches schema', async () => {
    const result = await runAudit({ cwd: cleanDir });
    expect(result.clean).toBe(true);
    expect(result.drifted).toHaveLength(0);
  });
});

describe('runAudit - drift detection', () => {
  it('detects a modified favicon file', async () => {
    const dir = await createProject(); dirs.push(dir);
    await runEmit({ cwd: dir });
    writeFileSync(join(dir, 'public', 'brand', 'favicons', 'favicon-32.png'), Buffer.from('bad'));

    const result = await runAudit({ cwd: dir });
    expect(result.clean).toBe(false);
    expect(result.drifted.some((p) => p.includes('favicon-32'))).toBe(true);
  });

  it('detects a modified swatches.json', async () => {
    const dir = await createProject(); dirs.push(dir);
    await runEmit({ cwd: dir });
    writeFileSync(join(dir, 'public', 'brand', 'swatches.json'), '{"primary":"#ff0000"}\n');

    const result = await runAudit({ cwd: dir });
    expect(result.clean).toBe(false);
    expect(result.drifted.some((p) => p.includes('swatches'))).toBe(true);
  });

  it('detects a modified OG image', async () => {
    const dir = await createProject(); dirs.push(dir);
    await runEmit({ cwd: dir });
    writeFileSync(join(dir, 'public', 'brand', 'og.png'), Buffer.from('corrupt'));

    const result = await runAudit({ cwd: dir });
    expect(result.clean).toBe(false);
    expect(result.drifted.some((p) => p.includes('og.png'))).toBe(true);
  });

  it('reports all drifted paths when multiple files are modified', async () => {
    const dir = await createProject(); dirs.push(dir);
    await runEmit({ cwd: dir });
    writeFileSync(join(dir, 'public', 'brand', 'favicons', 'favicon-16.png'), Buffer.from('bad1'));
    writeFileSync(join(dir, 'public', 'brand', 'swatches.json'), '{"x":"y"}\n');

    const result = await runAudit({ cwd: dir });
    expect(result.clean).toBe(false);
    expect(result.drifted.length).toBeGreaterThanOrEqual(2);
  });

  it('detects an extra file added to public/brand/', async () => {
    const dir = await createProject(); dirs.push(dir);
    await runEmit({ cwd: dir });
    writeFileSync(join(dir, 'public', 'brand', 'extra-file.txt'), 'injected');

    const result = await runAudit({ cwd: dir });
    expect(result.clean).toBe(false);
    expect(result.drifted.some((p) => p.includes('extra-file'))).toBe(true);
  });
});

describe('runAudit - missing brand surface', () => {
  it('reports drift when public/brand/ has not been emitted', async () => {
    const dir = await createProject(); dirs.push(dir);
    const result = await runAudit({ cwd: dir });
    expect(result.clean).toBe(false);
    expect(result.drifted.length).toBeGreaterThan(0);
  });

  it('drift message mentions public/brand/', async () => {
    const dir = await createProject(); dirs.push(dir);
    const result = await runAudit({ cwd: dir });
    expect(result.drifted.some((p) => p.includes('public/brand'))).toBe(true);
  });
});

describe('runAudit - error handling', () => {
  it('throws when schema file is missing', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'vbrand-audit-noschema-'));
    dirs.push(dir);
    await expect(runAudit({ cwd: dir })).rejects.toThrow('not found');
  });
});

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
}, 30000);
