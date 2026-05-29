// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { afterAll, describe, expect, it } from 'vitest';
import { runMarksGeometry } from '../src/lib/audit/marks-geometry.js';
import type { VbrandType } from '../src/schema.js';

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

const BASE: VbrandType = {
  name: 'marks-test',
  voice: { canonical: 'Test.', repoDescription: 'Marks test.' },
  assets: {
    favicon: { source: 'logo.png', sizes: [32] },
    og: { dimensions: [1200, 630] },
    icons: { source: 'icons/', set: [] },
  },
  tokens: { color: {}, type: {} },
};

async function makeTempDir(): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), 'vbrand-marks-'));
  dirs.push(dir);
  return dir;
}

async function writePng(dir: string, name: string, w: number, h: number): Promise<string> {
  const path = join(dir, name);
  await sharp({
    create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 255 } },
  }).png().toFile(path);
  return name;
}

describe('runMarksGeometry - no marks', () => {
  it('returns empty array when schema.marks is undefined', async () => {
    const dir = await makeTempDir();
    expect(await runMarksGeometry(BASE, dir)).toHaveLength(0);
  });

  it('returns empty array when marks.variants is empty', async () => {
    const dir = await makeTempDir();
    const schema: VbrandType = { ...BASE, marks: { variants: [] } };
    expect(await runMarksGeometry(schema, dir)).toHaveLength(0);
  });
});

describe('runMarksGeometry - missing file', () => {
  it('reports missing-file when variant source does not exist', async () => {
    const dir = await makeTempDir();
    const schema: VbrandType = {
      ...BASE,
      marks: { variants: [{ name: 'primary', source: 'missing-logo.png' }] },
    };
    const findings = await runMarksGeometry(schema, dir);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.reason).toBe('missing-file');
    expect(findings[0]!.source).toBe('missing-logo.png');
  });
});

describe('runMarksGeometry - logoMinWidth', () => {
  it('passes when logo width meets minimum', async () => {
    const dir = await makeTempDir();
    await writePng(dir, 'logo.png', 400, 100);
    const schema: VbrandType = {
      ...BASE,
      marks: {
        logoMinWidth: 200,
        variants: [{ name: 'primary', source: 'logo.png' }],
      },
    };
    const findings = await runMarksGeometry(schema, dir);
    expect(findings).toHaveLength(0);
  });

  it('fails when logo width is below minimum', async () => {
    const dir = await makeTempDir();
    await writePng(dir, 'logo-narrow.png', 100, 100);
    const schema: VbrandType = {
      ...BASE,
      marks: {
        logoMinWidth: 200,
        variants: [{ name: 'primary', source: 'logo-narrow.png' }],
      },
    };
    const findings = await runMarksGeometry(schema, dir);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.reason).toBe('too-narrow');
    expect(findings[0]!.detail).toContain('100px');
    expect(findings[0]!.detail).toContain('200px');
  });
});

describe('runMarksGeometry - logoAspectRatio', () => {
  it('passes when logo aspect ratio matches', async () => {
    const dir = await makeTempDir();
    await writePng(dir, 'logo-4x1.png', 400, 100);
    const schema: VbrandType = {
      ...BASE,
      marks: {
        logoAspectRatio: '4:1',
        variants: [{ name: 'primary', source: 'logo-4x1.png' }],
      },
    };
    const findings = await runMarksGeometry(schema, dir);
    expect(findings).toHaveLength(0);
  });

  it('fails when logo aspect ratio does not match', async () => {
    const dir = await makeTempDir();
    await writePng(dir, 'logo-sq.png', 200, 100);
    const schema: VbrandType = {
      ...BASE,
      marks: {
        logoAspectRatio: '4:1',
        variants: [{ name: 'primary', source: 'logo-sq.png' }],
      },
    };
    const findings = await runMarksGeometry(schema, dir);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.reason).toBe('wrong-aspect');
  });

  it('passes within 2% tolerance', async () => {
    const dir = await makeTempDir();
    // 4:1 expected; 406:100 actual = 4.06, within 2% of 4.0
    await writePng(dir, 'logo-close.png', 406, 100);
    const schema: VbrandType = {
      ...BASE,
      marks: {
        logoAspectRatio: '4:1',
        variants: [{ name: 'primary', source: 'logo-close.png' }],
      },
    };
    const findings = await runMarksGeometry(schema, dir);
    expect(findings).toHaveLength(0);
  });
});

describe('runMarksGeometry - multiple variants', () => {
  it('checks each variant independently', async () => {
    const dir = await makeTempDir();
    await writePng(dir, 'logo-ok.png', 400, 100);
    // logo-bad.png does not exist
    const schema: VbrandType = {
      ...BASE,
      marks: {
        logoMinWidth: 200,
        variants: [
          { name: 'primary', source: 'logo-ok.png' },
          { name: 'dark', source: 'logo-bad.png' },
        ],
      },
    };
    const findings = await runMarksGeometry(schema, dir);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.source).toBe('logo-bad.png');
    expect(findings[0]!.reason).toBe('missing-file');
  });

  it('reports both minWidth and aspect failures on same variant', async () => {
    const dir = await makeTempDir();
    // narrow AND wrong aspect ratio
    await writePng(dir, 'logo-fail.png', 100, 100);
    const schema: VbrandType = {
      ...BASE,
      marks: {
        logoMinWidth: 200,
        logoAspectRatio: '4:1',
        variants: [{ name: 'primary', source: 'logo-fail.png' }],
      },
    };
    const findings = await runMarksGeometry(schema, dir);
    expect(findings.length).toBeGreaterThanOrEqual(2);
    expect(findings.some((f) => f.reason === 'too-narrow')).toBe(true);
    expect(findings.some((f) => f.reason === 'wrong-aspect')).toBe(true);
  });
});

describe('runMarksGeometry - invalid files', () => {
  it('reports missing-file for a non-image file', async () => {
    const dir = await makeTempDir();
    writeFileSync(join(dir, 'not-an-image.png'), 'not png data');
    const schema: VbrandType = {
      ...BASE,
      marks: {
        variants: [{ name: 'primary', source: 'not-an-image.png' }],
      },
    };
    const findings = await runMarksGeometry(schema, dir);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.reason).toBe('missing-file');
  });
});
