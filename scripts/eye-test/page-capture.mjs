// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import sharp from 'sharp';
import { cellToUrl } from './url-builder.mjs';

const VIEWPORT       = { width: 1280, height: 800 };
const NAV_TIMEOUT_MS = 30_000;
const BRAND_WAIT_MS  = 15_000;
const MAX_RETRIES    = 1;

async function waitForBrandToken(page) {
  await page.waitForFunction(
    () => document.documentElement.style.getPropertyValue('--color-primary').trim() !== '',
    { timeout: BRAND_WAIT_MS },
  );
}

async function readPrimaryToken(page) {
  return page.evaluate(
    () => document.documentElement.style.getPropertyValue('--color-primary').trim(),
  );
}

async function measureIframeStylesheets(page, mode) {
  if (mode === 'spa') return 0;
  const title = mode === 'static' ? 'static render' : 'hybrid render';
  try {
    return await page.frameLocator(`iframe[title="${title}"]`).first()
      .locator('html').evaluate(() => document.styleSheets.length);
  } catch { return 0; }
}

async function measureIslandCount(page) {
  try {
    return await page.frameLocator('iframe[title="hybrid render"]').first()
      .locator('[data-island]').count();
  } catch { return 0; }
}

async function errorThumbnail(w, h) {
  return sharp({ create: { width: w, height: h, channels: 3, background: { r: 180, g: 40, b: 40 } } })
    .png().toBuffer();
}

async function attemptCapture(page, cell, baseUrl, thumbW, thumbH) {
  await page.goto(cellToUrl(cell, baseUrl), { timeout: NAV_TIMEOUT_MS, waitUntil: 'domcontentloaded' });
  await waitForBrandToken(page);
  const [primary, iframeSheetCount, islandCount] = await Promise.all([
    readPrimaryToken(page),
    measureIframeStylesheets(page, cell.mode),
    cell.mode === 'hybrid' ? measureIslandCount(page) : Promise.resolve(0),
  ]);
  const raw       = await page.screenshot();
  const thumbnail = await sharp(raw).resize(thumbW, thumbH, { fit: 'fill' }).png().toBuffer();
  return { ...cell, primary, iframeSheetCount, islandCount, thumbnail, error: null };
}

async function captureWithRetry(context, cell, baseUrl, thumbW, thumbH) {
  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const page = await context.newPage();
    try {
      const result = await attemptCapture(page, cell, baseUrl, thumbW, thumbH);
      await page.close();
      return result;
    } catch (err) {
      lastError = err;
      await page.close();
    }
  }
  return {
    ...cell,
    primary: '',
    iframeSheetCount: 0,
    islandCount: 0,
    thumbnail: await errorThumbnail(thumbW, thumbH),
    error: String(lastError),
  };
}

export async function captureAll(browser, cells, baseUrl, { thumbW, thumbH, concurrency, onProgress } = {}) {
  const w     = thumbW      ?? 320;
  const h     = thumbH      ?? 200;
  const batch = concurrency ?? 4;
  const results = [];

  for (let i = 0; i < cells.length; i += batch) {
    const slice    = cells.slice(i, i + batch);
    const contexts = await Promise.all(slice.map(() => browser.newContext({ viewport: VIEWPORT })));
    const captured = await Promise.all(slice.map((cell, j) => captureWithRetry(contexts[j], cell, baseUrl, w, h)));
    await Promise.all(contexts.map((ctx) => ctx.close()));
    results.push(...captured);
    onProgress?.(Math.min(i + batch, cells.length), cells.length);
  }

  return results;
}
