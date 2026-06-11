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

test('load-fixture-clickcount: fixture via examples dropdown reaches brand URL in <=2 clicks', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}?app=landing`);
  await waitForBrand(page);

  let clicks = 0;
  await page.locator('details summary').click();
  clicks++;
  await expect(page.locator('button:has-text("Vercel (fixture)")')).toBeVisible({ timeout: 5_000 });
  await page.locator('button:has-text("Vercel (fixture)")').click();
  clicks++;

  await page.waitForURL(/brand=fixture%3Avercel/, { timeout: 8_000 });
  expect(clicks).toBeLessThanOrEqual(2);
});

test('load-fixture-clickcount: brand input Enter key triggers load without additional clicks', async ({ page }) => {
  await page.goto(`${BASE}?app=landing`);
  await waitForBrand(page);

  const input = page.locator('nav input[type="text"], nav input:not([type])').first();
  await expect(input).toBeVisible({ timeout: 5_000 });
  await input.fill('fixture:linear');
  await input.press('Enter');

  await page.waitForURL(/brand=fixture%3Alinear/, { timeout: 8_000 });
  expect(page.url()).toContain('brand=fixture%3Alinear');
});
