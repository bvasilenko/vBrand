// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { test, expect } from '@playwright/test';
import { ALL_FIXTURE_META } from './fixture-primaries.js';

const BASE = '/vBrand/';

type PwPage = import('@playwright/test').Page;

async function waitForBrand(page: PwPage): Promise<void> {
  await page.waitForFunction(
    () => document.documentElement.style.getPropertyValue('--color-primary').trim() !== '',
    { timeout: 10_000 },
  );
}

async function readRootPrimary(page: PwPage): Promise<string> {
  return page.evaluate(
    () => document.documentElement.style.getPropertyValue('--color-primary').trim(),
  );
}

for (const { handle, label, expectedPrimary } of ALL_FIXTURE_META) {
  test(`examples-dropdown: clicking ${label} navigates and applies brand color`, async ({ page }) => {
    await page.goto(`${BASE}?app=landing`);
    await waitForBrand(page);

    await page.locator('details summary').click();
    await expect(page.locator(`button:has-text("${label}")`)).toBeVisible({ timeout: 5_000 });

    await page.locator(`button:has-text("${label}")`).click();
    await page.waitForURL(new RegExp(`brand=fixture%3A${handle}`), { timeout: 8_000 });

    expect(page.url()).toContain(`brand=fixture%3A${handle}`);

    await waitForBrand(page);
    const primary = await readRootPrimary(page);
    expect(primary.toLowerCase()).toBe(expectedPrimary);
  });
}

test('examples-dropdown: panel anchors to the right and stays in viewport at 1280px', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${BASE}?app=landing`);
  await waitForBrand(page);

  await page.locator('details summary').click();
  const btn = page.locator('button:has-text("Vercel (fixture)")');
  await expect(btn).toBeVisible({ timeout: 5_000 });

  const box = await btn.boundingBox();
  expect(box).not.toBeNull();
  if (box) expect(box.x + box.width).toBeLessThanOrEqual(1280);
});

test('examples-dropdown: panel closes after fixture button click', async ({ page }) => {
  await page.goto(`${BASE}?app=landing`);
  await waitForBrand(page);

  await page.locator('details summary').click();
  await expect(page.locator('button:has-text("Stripe (fixture)")')).toBeVisible({ timeout: 5_000 });

  await page.locator('button:has-text("Stripe (fixture)")').click();
  await page.waitForURL(/brand=fixture/, { timeout: 8_000 });

  await expect(page.locator('button:has-text("Stripe (fixture)")')).not.toBeVisible({ timeout: 3_000 });
});
