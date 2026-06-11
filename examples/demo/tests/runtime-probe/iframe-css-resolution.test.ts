// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { test, expect } from '@playwright/test';
import { ALL_FIXTURE_META } from './fixture-primaries.js';

const BASE = '/vBrand/';
const MIN_IFRAME_STYLESHEET_COUNT = 2;
const INDIGO_FALLBACK = '#6366f1';

type PwPage = import('@playwright/test').Page;

async function waitForBrand(page: PwPage): Promise<void> {
  await page.waitForFunction(
    () => document.documentElement.style.getPropertyValue('--color-primary').trim() !== '',
    { timeout: 10_000 },
  );
}

function readIframePrimary(el: HTMLElement): string {
  return getComputedStyle(el).getPropertyValue('--color-primary').trim();
}

function readStylesheetCount(): number {
  return document.styleSheets.length;
}

function readRootPrimary(): string {
  return document.documentElement.style.getPropertyValue('--color-primary').trim();
}

for (const { handle, expectedPrimary } of ALL_FIXTURE_META) {
  test(`iframe-css-resolution: static/${handle} applies --color-primary inside iframe`, async ({ page }) => {
    await page.goto(`${BASE}?app=landing&brand=fixture:${handle}&mode=static`);
    await waitForBrand(page);

    await expect(page.locator('iframe[title="static render"]')).toBeVisible({ timeout: 8_000 });
    const frame = page.frameLocator('iframe[title="static render"]').first();

    const primary = await frame.locator('html').evaluate(readIframePrimary);
    const sheetCount = await frame.locator('html').evaluate(readStylesheetCount);

    expect(primary.toLowerCase()).toBe(expectedPrimary);
    expect(primary.toLowerCase()).not.toBe(INDIGO_FALLBACK);
    expect(sheetCount).toBeGreaterThanOrEqual(MIN_IFRAME_STYLESHEET_COUNT);
  });

  test(`iframe-css-resolution: hybrid/${handle} applies --color-primary inside iframe`, async ({ page }) => {
    await page.goto(`${BASE}?app=landing&brand=fixture:${handle}&mode=hybrid`);
    await waitForBrand(page);

    await expect(page.locator('iframe[title="hybrid render"]')).toBeVisible({ timeout: 8_000 });
    const frame = page.frameLocator('iframe[title="hybrid render"]').first();

    const primary = await frame.locator('html').evaluate(readIframePrimary);
    const sheetCount = await frame.locator('html').evaluate(readStylesheetCount);

    expect(primary.toLowerCase()).toBe(expectedPrimary);
    expect(primary.toLowerCase()).not.toBe(INDIGO_FALLBACK);
    expect(sheetCount).toBeGreaterThanOrEqual(MIN_IFRAME_STYLESHEET_COUNT);
  });

  test(`iframe-css-resolution: spa/${handle} applies --color-primary on document root`, async ({ page }) => {
    await page.goto(`${BASE}?app=landing&brand=fixture:${handle}&mode=spa`);
    await waitForBrand(page);

    const primary = await page.evaluate(readRootPrimary);

    expect(primary.toLowerCase()).toBe(expectedPrimary);
    expect(primary.toLowerCase()).not.toBe(INDIGO_FALLBACK);
  });
}

test('iframe-css-resolution: no triple-hyphen --v--- pattern in static iframe body', async ({ page }) => {
  await page.goto(`${BASE}?app=landing&brand=fixture:stripe&mode=static`);
  await waitForBrand(page);

  await expect(page.locator('iframe[title="static render"]')).toBeVisible({ timeout: 8_000 });
  const frame = page.frameLocator('iframe[title="static render"]').first();

  const bodyHTML = await frame.locator('body').evaluate((el) => el.innerHTML);
  expect(bodyHTML).not.toContain('--v---');
});
