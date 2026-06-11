// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { test, expect } from '@playwright/test';

const BASE = '/vBrand/';

const TEMPLATE_ISLAND_EXPECTATIONS = [
  { templateId: 'landing',    minIslands: 2, badgePattern: /hybrid 2 islands/i },
  { templateId: 'marketing',  minIslands: 2, badgePattern: /hybrid 2 islands/i },
  { templateId: 'docs',       minIslands: 1, badgePattern: /hybrid 1 island$/i },
  { templateId: 'dashboard',  minIslands: 1, badgePattern: /hybrid 1 island$/i },
] as const;

async function waitForBrand(page: import('@playwright/test').Page) {
  await page.waitForFunction(
    () => document.documentElement.style.getPropertyValue('--color-primary').trim() !== '',
    { timeout: 10_000 },
  );
}

for (const { templateId, minIslands, badgePattern } of TEMPLATE_ISLAND_EXPECTATIONS) {
  test(`hybrid-islands: ${templateId} has at least ${minIslands} data-island markers in iframe`, async ({ page }) => {
    await page.goto(`${BASE}?app=${templateId}&brand=fixture:stripe&mode=hybrid`);
    await waitForBrand(page);

    await expect(page.locator('iframe[title="hybrid render"]')).toBeVisible({ timeout: 8_000 });

    const frame = page.frameLocator('iframe[title="hybrid render"]').first();
    const islandCount = await frame.locator('[data-island]').count();
    expect(islandCount).toBeGreaterThanOrEqual(minIslands);
  });

  test(`hybrid-islands: ${templateId} badge text matches island count in iframe`, async ({ page }) => {
    await page.goto(`${BASE}?app=${templateId}&brand=fixture:stripe&mode=hybrid`);
    await waitForBrand(page);

    const frame = page.frameLocator('iframe[title="hybrid render"]').first();
    const islandCount = await frame.locator('[data-island]').count();

    const badgeText = await page.locator('span:has-text(" island")').textContent();
    expect(badgeText).toMatch(new RegExp(`${islandCount} island`));
  });
}
