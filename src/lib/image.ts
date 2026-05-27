import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { optimize as svgoOptimize } from 'svgo';
import { ensureDir } from './fs.js';

const PNG_OPTIONS = {
  compressionLevel: 9,
  effort: 1,
  adaptiveFiltering: false,
} as const;

export async function emitFavicons(
  sourceFile: string,
  sizes: number[],
  outDir: string,
): Promise<void> {
  ensureDir(outDir);
  const sortedSizes = [...sizes].sort((a, b) => a - b);
  for (const size of sortedSizes) {
    await sharp(sourceFile)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png(PNG_OPTIONS)
      .withMetadata({})
      .toFile(join(outDir, `favicon-${size}.png`));
  }
}

export async function emitOgImage(
  sourceFile: string,
  dimensions: [number, number],
  outDir: string,
): Promise<void> {
  ensureDir(outDir);
  const [width, height] = dimensions;
  await sharp(sourceFile)
    .resize(width, height, { fit: 'cover', position: 'centre' })
    .png(PNG_OPTIONS)
    .withMetadata({})
    .toFile(join(outDir, 'og.png'));
}

export async function emitColorSwatches(
  colors: Record<string, string>,
  outDir: string,
): Promise<void> {
  ensureDir(outDir);
  const swatches: Record<string, string> = {};
  const sortedKeys = Object.keys(colors).sort();
  for (const key of sortedKeys) {
    swatches[key] = colors[key] ?? '';
  }
  const json = JSON.stringify(swatches, null, 2) + '\n';
  writeFileSync(join(outDir, 'swatches.json'), json, 'utf-8');
}

export async function emitIconSet(
  sourceDir: string,
  iconNames: string[],
  outDir: string,
): Promise<void> {
  ensureDir(outDir);
  const sortedNames = [...iconNames].sort();
  for (const name of sortedNames) {
    const srcPath = join(sourceDir, `${name}.svg`);
    let svgContent: string;
    try {
      svgContent = readFileSync(srcPath, 'utf-8');
    } catch {
      svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" fill="none"/></svg>`;
    }
    const result = svgoOptimize(svgContent, {
      plugins: [{ name: 'preset-default' }],
      js2svg: { pretty: false },
    });
    writeFileSync(join(outDir, `${name}.svg`), result.data, 'utf-8');
  }
}

export async function readImageDimensions(filePath: string): Promise<{ width: number; height: number }> {
  const meta = await sharp(filePath).metadata();
  return { width: meta.width ?? 0, height: meta.height ?? 0 };
}
