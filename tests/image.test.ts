import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { emitColorSwatches, emitIconSet } from '../src/lib/image.js';
import { ensureDir } from '../src/lib/fs.js';

const tmp = () => mkdtempSync(join(tmpdir(), 'vbrand-image-'));

const CIRCLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>`;

describe('emitColorSwatches - output contract', () => {
  const dirs: string[] = [];
  afterEach(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); dirs.length = 0; });

  it('creates swatches.json in the output directory', async () => {
    const dir = tmp(); dirs.push(dir);
    await emitColorSwatches({ primary: '#000' }, dir);
    expect(existsSync(join(dir, 'swatches.json'))).toBe(true);
  });

  it('output is valid JSON parseable back to an object', async () => {
    const dir = tmp(); dirs.push(dir);
    await emitColorSwatches({ primary: '#000', accent: '#fff' }, dir);
    const parsed = JSON.parse(readFileSync(join(dir, 'swatches.json'), 'utf-8')) as Record<string, string>;
    expect(typeof parsed).toBe('object');
  });

  it('preserves all color key-value pairs', async () => {
    const dir = tmp(); dirs.push(dir);
    const colors = { primary: '#0f172a', accent: '#6366f1', background: '#ffffff' };
    await emitColorSwatches(colors, dir);
    const parsed = JSON.parse(readFileSync(join(dir, 'swatches.json'), 'utf-8')) as Record<string, string>;
    for (const [key, val] of Object.entries(colors)) {
      expect(parsed[key]).toBe(val);
    }
  });

  it('keys are sorted alphabetically (determinism)', async () => {
    const dir = tmp(); dirs.push(dir);
    await emitColorSwatches({ zulu: '#z', alpha: '#a', mike: '#m' }, dir);
    const parsed = JSON.parse(readFileSync(join(dir, 'swatches.json'), 'utf-8')) as Record<string, string>;
    const keys = Object.keys(parsed);
    expect(keys).toEqual([...keys].sort());
  });

  it('empty color map produces an empty JSON object', async () => {
    const dir = tmp(); dirs.push(dir);
    await emitColorSwatches({}, dir);
    const parsed = JSON.parse(readFileSync(join(dir, 'swatches.json'), 'utf-8')) as Record<string, string>;
    expect(Object.keys(parsed)).toHaveLength(0);
  });

  it('output is deterministic: same input → byte-equal output', async () => {
    const dir1 = tmp(); dirs.push(dir1);
    const dir2 = tmp(); dirs.push(dir2);
    const colors = { primary: '#000', accent: '#fff', surface: '#f0f0f0' };
    await emitColorSwatches(colors, dir1);
    await emitColorSwatches(colors, dir2);
    const a = readFileSync(join(dir1, 'swatches.json'), 'utf-8');
    const b = readFileSync(join(dir2, 'swatches.json'), 'utf-8');
    expect(a).toBe(b);
  });
});

describe('emitIconSet - output contract', () => {
  const dirs: string[] = [];
  afterEach(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); dirs.length = 0; });

  it('creates one SVG file per named icon', async () => {
    const dir = tmp(); dirs.push(dir);
    const srcDir = join(dir, 'src-icons');
    const outDir = join(dir, 'out-icons');
    ensureDir(srcDir);
    writeFileSync(join(srcDir, 'menu.svg'), CIRCLE_SVG, 'utf-8');
    writeFileSync(join(srcDir, 'close.svg'), CIRCLE_SVG, 'utf-8');

    await emitIconSet(srcDir, ['menu', 'close'], outDir);

    expect(existsSync(join(outDir, 'menu.svg'))).toBe(true);
    expect(existsSync(join(outDir, 'close.svg'))).toBe(true);
  });

  it('output is valid SVG (starts with <svg)', async () => {
    const dir = tmp(); dirs.push(dir);
    const srcDir = join(dir, 'src-icons');
    const outDir = join(dir, 'out-icons');
    ensureDir(srcDir);
    writeFileSync(join(srcDir, 'arrow.svg'), CIRCLE_SVG, 'utf-8');

    await emitIconSet(srcDir, ['arrow'], outDir);

    const content = readFileSync(join(outDir, 'arrow.svg'), 'utf-8');
    expect(content.trim()).toMatch(/^<svg/);
  });

  it('emits a valid fallback SVG when source file is missing', async () => {
    const dir = tmp(); dirs.push(dir);
    const srcDir = join(dir, 'empty-icons');
    const outDir = join(dir, 'out-icons');
    ensureDir(srcDir);

    await emitIconSet(srcDir, ['nonexistent-icon'], outDir);

    expect(existsSync(join(outDir, 'nonexistent-icon.svg'))).toBe(true);
    const content = readFileSync(join(outDir, 'nonexistent-icon.svg'), 'utf-8');
    expect(content.trim()).toMatch(/^<svg/);
  });

  it('empty icon set produces no files in output directory', async () => {
    const dir = tmp(); dirs.push(dir);
    const outDir = join(dir, 'out-icons');
    await emitIconSet(join(dir, 'src'), [], outDir);
    ensureDir(outDir);
    expect(readdirSync(outDir)).toHaveLength(0);
  });

  it('is deterministic: same source SVGs → byte-equal output', async () => {
    const dir = tmp(); dirs.push(dir);
    const srcDir = join(dir, 'src-icons');
    const outDir1 = join(dir, 'out1');
    const outDir2 = join(dir, 'out2');
    ensureDir(srcDir);
    writeFileSync(join(srcDir, 'check.svg'), CIRCLE_SVG, 'utf-8');

    await emitIconSet(srcDir, ['check'], outDir1);
    await emitIconSet(srcDir, ['check'], outDir2);

    const a = readFileSync(join(outDir1, 'check.svg'), 'utf-8');
    const b = readFileSync(join(outDir2, 'check.svg'), 'utf-8');
    expect(a).toBe(b);
  });
});
