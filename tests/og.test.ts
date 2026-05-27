import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { emitOgImage, readImageDimensions } from '../src/lib/image.js';

const TARGET: [number, number] = [1200, 630];

let workDir: string;
let wideSource: string;
let tallSource: string;
let squareSource: string;

beforeAll(async () => {
  workDir = mkdtempSync(join(tmpdir(), 'vbrand-og-'));

  wideSource = join(workDir, 'wide.png');
  await sharp({ create: { width: 1600, height: 900, channels: 3, background: { r: 10, g: 20, b: 30 } } })
    .png().toFile(wideSource);

  tallSource = join(workDir, 'tall.png');
  await sharp({ create: { width: 400, height: 900, channels: 3, background: { r: 50, g: 60, b: 70 } } })
    .png().toFile(tallSource);

  squareSource = join(workDir, 'square.png');
  await sharp({ create: { width: 500, height: 500, channels: 3, background: { r: 80, g: 90, b: 100 } } })
    .png().toFile(squareSource);
});

afterAll(() => {
  rmSync(workDir, { recursive: true, force: true });
});

describe('emitOgImage - output dimensions', () => {
  it('produces og.png at exactly the requested dimensions from a wide source', async () => {
    const outDir = join(workDir, 'og-wide');
    await emitOgImage(wideSource, TARGET, outDir);
    const dims = await readImageDimensions(join(outDir, 'og.png'));
    expect(dims.width).toBe(TARGET[0]);
    expect(dims.height).toBe(TARGET[1]);
  });

  it('produces og.png at exactly the requested dimensions from a tall source', async () => {
    const outDir = join(workDir, 'og-tall');
    await emitOgImage(tallSource, TARGET, outDir);
    const dims = await readImageDimensions(join(outDir, 'og.png'));
    expect(dims.width).toBe(TARGET[0]);
    expect(dims.height).toBe(TARGET[1]);
  });

  it('produces og.png at exactly the requested dimensions from a square source', async () => {
    const outDir = join(workDir, 'og-square');
    await emitOgImage(squareSource, TARGET, outDir);
    const dims = await readImageDimensions(join(outDir, 'og.png'));
    expect(dims.width).toBe(TARGET[0]);
    expect(dims.height).toBe(TARGET[1]);
  });

  it('respects non-standard output dimensions', async () => {
    const custom: [number, number] = [800, 418];
    const outDir = join(workDir, 'og-custom');
    await emitOgImage(wideSource, custom, outDir);
    const dims = await readImageDimensions(join(outDir, 'og.png'));
    expect(dims.width).toBe(custom[0]);
    expect(dims.height).toBe(custom[1]);
  });
});

describe('emitOgImage - output naming', () => {
  it('output file is always named og.png', async () => {
    const outDir = join(workDir, 'og-name');
    await emitOgImage(wideSource, TARGET, outDir);
    const { existsSync } = await import('node:fs');
    expect(existsSync(join(outDir, 'og.png'))).toBe(true);
  });
});

describe('emitOgImage - determinism', () => {
  it('two runs from the same source produce byte-identical output', async () => {
    const outDir1 = join(workDir, 'og-det-1');
    const outDir2 = join(workDir, 'og-det-2');
    await emitOgImage(wideSource, TARGET, outDir1);
    await emitOgImage(wideSource, TARGET, outDir2);

    const { readFileSync } = await import('node:fs');
    const a = readFileSync(join(outDir1, 'og.png'));
    const b = readFileSync(join(outDir2, 'og.png'));
    expect(a.compare(b)).toBe(0);
  });
});

describe('emitOgImage - error handling', () => {
  it('rejects when source file does not exist', async () => {
    await expect(
      emitOgImage('/nonexistent/source.png', TARGET, join(workDir, 'og-err')),
    ).rejects.toThrow();
  });
});
