// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIXTURE_SLUGS, loadFixture } from '@booga/vfixtures';

const ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const DIST_DIR = path.join(ROOT, 'dist');
const GRID_OUTPUT = path.join(DIST_DIR, 'eye-test.png');
const MANIFEST_OUTPUT = path.join(DIST_DIR, 'eye-test-manifest.json');

const BASE_URL = process.env['EYE_TEST_BASE_URL'] ?? 'https://bvasilenko.github.io/vBrand/';

const THUMB_W = 320;
const THUMB_H = 200;
const CAPTION_H = 20;
const LABEL_W = 80;
const CELL_H = THUMB_H + CAPTION_H;

const FIXTURES = [...FIXTURE_SLUGS];
const APP_TYPES = ['landing', 'marketing', 'docs', 'dashboard'];
const MODES = ['static', 'hybrid', 'spa'];

const EXPECTED_PRIMARIES = Object.fromEntries(
  FIXTURES.map((slug) => [slug, (loadFixture(slug).tokens.color['primary'] ?? '').toLowerCase()]),
);

const BRAND_WAIT_TIMEOUT_MS = 15_000;
const NAV_TIMEOUT_MS = 30_000;
const CONCURRENCY = 4;
const MAX_RETRIES = 1;

function buildMatrix() {
  const cells = [];
  for (const fixture of FIXTURES) {
    for (const app of APP_TYPES) {
      for (const mode of MODES) {
        cells.push({ fixture, app, mode, url: `${BASE_URL}?app=${app}&brand=fixture:${fixture}&mode=${mode}` });
      }
    }
  }
  return cells;
}

async function waitForBrandToken(page) {
  await page.waitForFunction(
    () => document.documentElement.style.getPropertyValue('--color-primary').trim() !== '',
    { timeout: BRAND_WAIT_TIMEOUT_MS },
  );
}

async function measureIframeStylesheets(page, mode) {
  if (mode === 'spa') return 0;
  const title = mode === 'static' ? 'static render' : 'hybrid render';
  try {
    return await page.frameLocator(`iframe[title="${title}"]`).first()
      .locator('html').evaluate(() => document.styleSheets.length);
  } catch {
    return 0;
  }
}

async function measureIslandCount(page) {
  try {
    return await page.frameLocator('iframe[title="hybrid render"]').first()
      .locator('[data-island]').count();
  } catch {
    return 0;
  }
}

async function buildErrorPlaceholder() {
  return sharp({
    create: { width: THUMB_W, height: THUMB_H, channels: 3, background: { r: 200, g: 50, b: 50 } },
  }).jpeg().toBuffer();
}

async function attemptCaptureCell(page, cell) {
  await page.goto(cell.url, { timeout: NAV_TIMEOUT_MS, waitUntil: 'domcontentloaded' });
  await waitForBrandToken(page);
  const primary = await page.evaluate(
    () => document.documentElement.style.getPropertyValue('--color-primary').trim(),
  );
  const iframeSheetCount = await measureIframeStylesheets(page, cell.mode);
  const islandCount = cell.mode === 'hybrid' ? await measureIslandCount(page) : 0;
  const screenshot = await page.screenshot({ clip: { x: 0, y: 0, width: THUMB_W, height: THUMB_H } });
  return { ...cell, primary, iframeSheetCount, islandCount, screenshot, error: null };
}

async function captureCell(page, cell) {
  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await attemptCaptureCell(page, cell);
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES) {
        process.stdout.write(`  retry ${attempt + 1}/${MAX_RETRIES} for ${cell.fixture}/${cell.app}/${cell.mode}\n`);
      }
    }
  }
  return { ...cell, primary: '', iframeSheetCount: 0, islandCount: 0, screenshot: await buildErrorPlaceholder(), error: String(lastError) };
}

async function captureAll(cells) {
  const browser = await chromium.launch();
  const results = [];
  for (let i = 0; i < cells.length; i += CONCURRENCY) {
    const batch = cells.slice(i, i + CONCURRENCY);
    const pages = await Promise.all(batch.map(() => browser.newPage()));
    const batchResults = await Promise.all(batch.map((cell, idx) => captureCell(pages[idx], cell)));
    await Promise.all(pages.map((p) => p.close()));
    results.push(...batchResults);
    process.stdout.write(`  captured ${Math.min(i + CONCURRENCY, cells.length)}/${cells.length}\n`);
  }
  await browser.close();
  return results;
}

async function buildCaptionStrip(text, w, h, bgRgb, textRgb) {
  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${w}" height="${h}" fill="rgb(${bgRgb.join(',')})"/>
    <text x="${w / 2}" y="${h * 0.72}" font-family="monospace" font-size="9"
      text-anchor="middle" fill="rgb(${textRgb.join(',')}">${escapeXml(text)}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

function escapeXml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function buildGrid(results) {
  const cols = APP_TYPES.length * MODES.length;
  const rows = FIXTURES.length;
  const totalW = LABEL_W + cols * THUMB_W;
  const totalH = CAPTION_H + rows * CELL_H;
  const compositeInputs = [];

  for (let colIdx = 0; colIdx < cols; colIdx++) {
    const app = APP_TYPES[Math.floor(colIdx / MODES.length)];
    const mode = MODES[colIdx % MODES.length];
    const strip = await buildCaptionStrip(`${app}/${mode}`, THUMB_W, CAPTION_H, [30, 30, 30], [200, 200, 200]);
    compositeInputs.push({ input: strip, left: LABEL_W + colIdx * THUMB_W, top: 0 });
  }

  for (let rowIdx = 0; rowIdx < rows; rowIdx++) {
    const strip = await buildCaptionStrip(FIXTURES[rowIdx], LABEL_W, CELL_H, [20, 20, 60], [180, 200, 255]);
    compositeInputs.push({ input: strip, left: 0, top: CAPTION_H + rowIdx * CELL_H });
  }

  for (const result of results) {
    const rowIdx = FIXTURES.indexOf(result.fixture);
    const colIdx = APP_TYPES.indexOf(result.app) * MODES.length + MODES.indexOf(result.mode);
    const x = LABEL_W + colIdx * THUMB_W;
    const yThumb = CAPTION_H + rowIdx * CELL_H;

    const thumb = await sharp(result.screenshot).resize(THUMB_W, THUMB_H, { fit: 'cover' }).png().toBuffer();
    compositeInputs.push({ input: thumb, left: x, top: yThumb });

    const captionText = result.error ? 'ERROR' : result.primary;
    const captionBg = result.error ? [120, 0, 0] : [20, 20, 20];
    const captionFg = result.error ? [255, 180, 180] : [160, 200, 160];
    const caption = await buildCaptionStrip(captionText, THUMB_W, CAPTION_H, captionBg, captionFg);
    compositeInputs.push({ input: caption, left: x, top: yThumb + THUMB_H });
  }

  await sharp({
    create: { width: totalW, height: totalH, channels: 3, background: { r: 10, g: 10, b: 10 } },
  }).composite(compositeInputs).png().toFile(GRID_OUTPUT);
}

function writeManifest(results) {
  const manifest = results.map(({ screenshot: _s, ...rest }) => ({
    ...rest,
    expectedPrimary: EXPECTED_PRIMARIES[rest.fixture] ?? null,
    primaryMatch: rest.primary.toLowerCase() === (EXPECTED_PRIMARIES[rest.fixture] ?? '').toLowerCase(),
  }));
  fs.writeFileSync(MANIFEST_OUTPUT, JSON.stringify(manifest, null, 2));
}

function buildFailureReason(cell) {
  if (cell.error) return `navigation error: ${cell.error}`;
  const expected = EXPECTED_PRIMARIES[cell.fixture];
  if (expected && cell.primary.toLowerCase() !== expected.toLowerCase()) {
    return `primary color mismatch: expected ${expected}, got ${cell.primary}`;
  }
  if (cell.mode !== 'spa' && cell.iframeSheetCount < 2) {
    return `iframe stylesheet count ${cell.iframeSheetCount} < 2`;
  }
  if (cell.mode === 'hybrid' && cell.islandCount < 1) {
    return `hybrid island count ${cell.islandCount} < 1`;
  }
  return 'unknown';
}

function printDiffReport(results) {
  const failures = results.filter((r) => {
    if (r.error) return true;
    const expected = EXPECTED_PRIMARIES[r.fixture];
    if (expected && r.primary.toLowerCase() !== expected.toLowerCase()) return true;
    if (r.mode !== 'spa' && r.iframeSheetCount < 2) return true;
    if (r.mode === 'hybrid' && r.islandCount < 1) return true;
    return false;
  });
  if (failures.length === 0) {
    process.stdout.write(`\nAll ${results.length} cells passed automated diff checks.\n`);
    return;
  }
  process.stdout.write(`\nAutomated diff: ${failures.length} cell(s) flagged for chief-executive review:\n`);
  for (const f of failures) {
    process.stdout.write(`  [${f.fixture}/${f.app}/${f.mode}] ${buildFailureReason(f)}\n`);
  }
}

async function main() {
  fs.mkdirSync(DIST_DIR, { recursive: true });
  const totalCells = FIXTURES.length * APP_TYPES.length * MODES.length;
  process.stdout.write(`Eye-test grid: ${FIXTURES.length} fixtures x ${APP_TYPES.length} apps x ${MODES.length} modes = ${totalCells} cells\n`);
  process.stdout.write(`Base URL: ${BASE_URL}\n\n`);
  const cells = buildMatrix();
  const results = await captureAll(cells);
  process.stdout.write('\nBuilding grid PNG...\n');
  await buildGrid(results);
  process.stdout.write(`Grid written to ${GRID_OUTPUT}\n`);
  writeManifest(results);
  process.stdout.write(`Manifest written to ${MANIFEST_OUTPUT}\n`);
  printDiffReport(results);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
