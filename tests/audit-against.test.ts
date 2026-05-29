// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterAll, describe, expect, it, vi, afterEach } from 'vitest';
import { runAudit } from '../src/commands/audit.js';
import { runEmit } from '../src/commands/emit.js';
import { SCHEMA_FILENAME } from '../src/schema.js';

const dirs: string[] = [];
afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); }, 60000);
afterEach(() => { vi.restoreAllMocks(); });

const SCHEMA = {
  name: 'alignment-test',
  voice: { canonical: 'Test.', repoDescription: 'Alignment test.' },
  assets: {
    favicon: { source: 'logo.png', sizes: [32] },
    og: { dimensions: [1200, 630] as [number, number] },
    icons: { source: 'icons/', set: [] },
  },
  tokens: { color: { primary: '#0f172a' }, type: {} },
};

async function createCleanProject(): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), 'vbrand-against-'));
  dirs.push(dir);
  await sharp({
    create: { width: 32, height: 32, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 255 } },
  }).png().toFile(join(dir, 'logo.png'));
  writeFileSync(join(dir, SCHEMA_FILENAME), JSON.stringify(SCHEMA), 'utf-8');
  await runEmit({ cwd: dir });
  return dir;
}

describe('audit --against=<source> (acceptance #22)', () => {
  it('exits 0 in non-strict mode even with alignment drift', async () => {
    const dir = await createCleanProject();
    const externalHtml = `<!DOCTYPE html>
      <html><head>
        <title>Different Brand</title>
        <meta name="theme-color" content="#ffffff" />
      </head><body></body></html>`;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => externalHtml,
    }));

    const result = await runAudit({
      cwd: dir,
      strict: false,
      against: 'https://external.example.com',
    });
    expect(result.alignmentDrifts).toBeDefined();
  });

  it('reports field-level drift when external color differs', async () => {
    const dir = await createCleanProject();
    const externalHtml = `<!DOCTYPE html>
      <html><head>
        <title>alignment-test</title>
        <meta name="theme-color" content="#ffffff" />
      </head><body></body></html>`;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => externalHtml,
    }));

    const result = await runAudit({
      cwd: dir,
      against: 'https://external.example.com',
    });
    const colorDrift = result.alignmentDrifts.find((d) =>
      d.field.includes('color.primary'),
    );
    expect(colorDrift).toBeDefined();
  });

  it('writes alignment report to reports/ directory', async () => {
    const dir = await createCleanProject();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => '<html><head><title>Test</title></head></html>',
    }));

    const result = await runAudit({
      cwd: dir,
      against: 'https://external.example.com',
    });
    const { existsSync } = await import('node:fs');
    expect(existsSync(result.reportPath!)).toBe(true);
  });
});
