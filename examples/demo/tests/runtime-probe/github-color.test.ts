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

test('github-color: vercel/next.js derives TypeScript brand color not indigo fallback', async ({ page }) => {
  await page.goto(`${BASE}?app=landing&brand=github:vercel/next.js`);
  await waitForBrand(page);

  const primary = await page.evaluate(
    () => document.documentElement.style.getPropertyValue('--color-primary').trim(),
  );
  expect(primary.toLowerCase()).not.toBe('#6366f1');
  expect(primary.toLowerCase()).toBe('#3178c6');
});
