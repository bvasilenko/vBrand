import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { emitFavicons, readImageDimensions } from '../src/lib/image.js';

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];

let workDir: string;
let squareSource: string;

beforeAll(async () => {
  workDir = mkdtempSync(join(tmpdir(), 'vbrand-favicon-'));
  squareSource = join(workDir, 'logo.png');
  await sharp({
    create: { width: 512, height: 512, channels: 4, background: { r: 99, g: 102, b: 241, alpha: 255 } },
  })
    .png()
    .toFile(squareSource);
});

afterAll(() => {
  rmSync(workDir, { recursive: true, force: true });
});

describe('emitFavicons - output existence', () => {
  it('produces exactly one file per requested size', async () => {
    const sizes = [16, 32, 64, 180, 512];
    const outDir = join(workDir, 'fav-existence');
    await emitFavicons(squareSource, sizes, outDir);
    for (const size of sizes) {
      expect(existsSync(join(outDir, `favicon-${size}.png`)), `favicon-${size}.png`).toBe(true);
    }
  });

  it('works with a single-element sizes array', async () => {
    const outDir = join(workDir, 'fav-single');
    await emitFavicons(squareSource, [48], outDir);
    expect(existsSync(join(outDir, 'favicon-48.png'))).toBe(true);
  });
});

describe('emitFavicons - output dimensions', () => {
  it('each output file has exactly the requested pixel dimensions', async () => {
    const sizes = [16, 32, 64];
    const outDir = join(workDir, 'fav-dims');
    await emitFavicons(squareSource, sizes, outDir);
    for (const size of sizes) {
      const dims = await readImageDimensions(join(outDir, `favicon-${size}.png`));
      expect(dims.width, `width at ${size}`).toBe(size);
      expect(dims.height, `height at ${size}`).toBe(size);
    }
  });
});

describe('emitFavicons - output format', () => {
  it('output files have valid PNG magic bytes', async () => {
    const outDir = join(workDir, 'fav-format');
    await emitFavicons(squareSource, [32], outDir);
    const { readFileSync } = await import('node:fs');
    const bytes = readFileSync(join(outDir, 'favicon-32.png'));
    for (let i = 0; i < PNG_MAGIC.length; i++) {
      expect(bytes[i], `magic byte ${i}`).toBe(PNG_MAGIC[i]);
    }
  });
});

describe('emitFavicons - determinism', () => {
  it('two runs produce byte-identical output for the same sizes', async () => {
    const outDir1 = join(workDir, 'fav-det-1');
    const outDir2 = join(workDir, 'fav-det-2');
    await emitFavicons(squareSource, [32, 64], outDir1);
    await emitFavicons(squareSource, [32, 64], outDir2);

    const { readFileSync } = await import('node:fs');
    for (const size of [32, 64]) {
      const a = readFileSync(join(outDir1, `favicon-${size}.png`));
      const b = readFileSync(join(outDir2, `favicon-${size}.png`));
      expect(a.compare(b), `favicon-${size}.png`).toBe(0);
    }
  });
});

describe('emitFavicons - error handling', () => {
  it('rejects when source file does not exist', async () => {
    await expect(
      emitFavicons('/nonexistent/logo.png', [32], join(workDir, 'fav-err')),
    ).rejects.toThrow();
  });
});
