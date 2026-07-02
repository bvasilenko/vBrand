// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIXTURES, APP_TYPES, MODES, STACKS, CMS_SUBSTRATES } from './axes.mjs';
import { latinSquareSample, allCells } from './cell-generator.mjs';
import { captureAll } from './page-capture.mjs';
import { loadStackEmitShapes } from './stack-snippets.mjs';
import { buildGrid, THUMB_W, THUMB_H } from './grid-image.mjs';
import { loadExpectedPrimaries, writeManifest, printDiffReport } from './diff-reporter.mjs';

const ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');

function resolveOutputDir(outputDir) {
  return path.isAbsolute(outputDir) ? outputDir : path.join(ROOT, outputDir);
}

function cellCountLabel(cells, exhaustive) {
  if (exhaustive) {
    return [
      FIXTURES.length, APP_TYPES.length, MODES.length, STACKS.length, CMS_SUBSTRATES.length,
    ].join('x') + ` = ${cells.length} cells (exhaustive)`;
  }
  return `${cells.length} cells (Latin-square)`;
}

export async function run({ exhaustive, baseUrl, outputDir, concurrency }) {
  const cells         = exhaustive ? allCells() : latinSquareSample();
  const emitShapes    = loadStackEmitShapes(path.join(ROOT, 'dist'));
  const outDir        = resolveOutputDir(outputDir);
  const gridPath      = path.join(outDir, 'eye-test.png');
  const manifestPath  = path.join(outDir, 'eye-test-manifest.json');

  fs.mkdirSync(outDir, { recursive: true });

  process.stdout.write(`Eye-test grid: ${cellCountLabel(cells, exhaustive)}\nBase URL: ${baseUrl}\n\n`);

  const browser = await chromium.launch();
  try {
    const results = await captureAll(browser, cells, baseUrl, {
      thumbW:      THUMB_W,
      thumbH:      THUMB_H,
      concurrency,
      onProgress:  (done, total) => process.stdout.write(`  captured ${done}/${total}\n`),
    });

    process.stdout.write('\nBuilding grid PNG...\n');
    const gridPng = await buildGrid(results, emitShapes, { exhaustive });
    fs.writeFileSync(gridPath, gridPng);
    process.stdout.write(`Grid written to ${gridPath}\n`);

    const expectedPrimaries = loadExpectedPrimaries();
    writeManifest(results, manifestPath, expectedPrimaries);
    process.stdout.write(`Manifest written to ${manifestPath}\n`);

    printDiffReport(results, expectedPrimaries);
  } finally {
    await browser.close();
  }
}
