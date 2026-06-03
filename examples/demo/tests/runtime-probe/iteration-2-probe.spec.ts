// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { test, expect } from '@playwright/test';

const BASE = '/vBrand/';

async function waitForBrand(page: import('@playwright/test').Page) {
  await page.waitForFunction(
    () => document.documentElement.style.getPropertyValue('--color-primary').trim() !== '',
    { timeout: 10_000 },
  );
}

test('mode select renders in nav bar for all 3 modes', async ({ page }) => {
  await page.goto(`${BASE}?app=landing`);
  await waitForBrand(page);

  const modeSelect = page.locator('nav select').nth(1);
  await expect(modeSelect).toBeVisible({ timeout: 5_000 });

  const options = await modeSelect.locator('option').allInnerTexts();
  expect(options).toContain('static');
  expect(options).toContain('hybrid');
  expect(options).toContain('spa');
});

test('changing mode to static writes mode=static into URL search params', async ({ page }) => {
  await page.goto(`${BASE}?app=landing`);
  await waitForBrand(page);

  const modeSelect = page.locator('nav select').nth(1);
  await expect(modeSelect).toBeVisible({ timeout: 5_000 });
  await modeSelect.selectOption('static');

  await page.waitForURL(/mode=static/, { timeout: 5_000 });
  expect(page.url()).toContain('mode=static');
});

test('static mode: rendered output is inside an iframe element', async ({ page }) => {
  await page.goto(`${BASE}?app=landing&mode=static`);
  await waitForBrand(page);

  await expect(page.locator('iframe[title="static render"]')).toBeVisible({ timeout: 8_000 });
});

test('hybrid mode: rendered output is inside an iframe element', async ({ page }) => {
  await page.goto(`${BASE}?app=landing&mode=hybrid`);
  await waitForBrand(page);

  await expect(page.locator('iframe[title="hybrid render"]')).toBeVisible({ timeout: 8_000 });
});

test('spa mode: no iframe is rendered (tree mounted directly)', async ({ page }) => {
  await page.goto(`${BASE}?app=landing`);
  await waitForBrand(page);

  const iframes = page.locator('iframe');
  await expect(iframes).toHaveCount(0, { timeout: 5_000 });
});

test('mode badge shows full hydration label in default spa mode', async ({ page }) => {
  await page.goto(`${BASE}?app=landing`);
  await waitForBrand(page);

  await expect(page.locator('text=full hydration').first()).toBeVisible({ timeout: 5_000 });
});

test('mode badge shows static label when mode=static', async ({ page }) => {
  await page.goto(`${BASE}?app=landing&mode=static`);
  await waitForBrand(page);

  await expect(page.locator('text=static').filter({ visible: true }).first()).toBeVisible({ timeout: 8_000 });
});

test('content editor panel is visible on template view', async ({ page }) => {
  await page.goto(`${BASE}?app=landing`);
  await waitForBrand(page);

  const contentHeader = page.getByText('Content', { exact: true });
  await expect(contentHeader).toBeVisible({ timeout: 5_000 });
});

test('typing in content editor updates the URL hash with a content key', async ({ page }) => {
  await page.goto(`${BASE}?app=landing`);
  await waitForBrand(page);

  const firstInput = page.locator('aside input[type="text"]').first();
  await expect(firstInput).toBeVisible({ timeout: 5_000 });
  await firstInput.fill('PROBE_OVERRIDE');

  await page.waitForFunction(
    () => window.location.hash.includes('content='),
    { timeout: 5_000 },
  );

  const hash = await page.evaluate(() => window.location.hash);
  expect(hash).toContain('content=');
});

test('content editor reset button clears content from URL hash', async ({ page }) => {
  await page.goto(`${BASE}?app=landing`);
  await waitForBrand(page);

  const firstInput = page.locator('aside input[type="text"]').first();
  await expect(firstInput).toBeVisible({ timeout: 5_000 });
  await firstInput.fill('PROBE_OVERRIDE');

  await page.waitForFunction(
    () => window.location.hash.includes('content='),
    { timeout: 5_000 },
  );

  await page.click('aside button:has-text("Reset")');

  await page.waitForFunction(
    () => !window.location.hash.includes('content='),
    { timeout: 5_000 },
  );

  const hash = await page.evaluate(() => window.location.hash);
  expect(hash).not.toContain('content=');
});

test('content editor fields are template-scoped: switching template shows different fields', async ({ page }) => {
  await page.goto(`${BASE}?app=landing`);
  await waitForBrand(page);

  const landingInputCount = await page.locator('aside input[type="text"]').count();

  const templateSelect = page.locator('nav select').first();
  await templateSelect.selectOption('docs');

  await page.waitForURL(/app=docs/, { timeout: 5_000 });
  await waitForBrand(page);

  const docsInputCount = await page.locator('aside input[type="text"]').count();
  expect(docsInputCount).not.toBe(landingInputCount);
});
