// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { test, expect } from '@playwright/test';

function extractVersion(text: string): string {
  return text.match(/vBrand (\S+)/)?.[1] ?? '';
}

test.describe('demo surface version stamp', () => {
  test('page title is stamped with a version string', async ({ page }) => {
    await page.goto('/vBrand/');
    const title = await page.title();
    expect(extractVersion(title).length).toBeGreaterThan(0);
  });

  test('page title has the expected structure: "vBrand <version> - adaptive themed demo"', async ({ page }) => {
    await page.goto('/vBrand/');
    const title = await page.title();
    expect(title).toMatch(/^vBrand \S+ - adaptive themed demo$/);
  });

  test('nav version label displays the same version as the page title', async ({ page }) => {
    await page.goto('/vBrand/');
    const titleVersion = extractVersion(await page.title());
    expect(titleVersion.length).toBeGreaterThan(0);
    const labelText = await page.locator('[data-version-label]').textContent({ timeout: 10_000 }) ?? '';
    expect(extractVersion(labelText)).toBe(titleVersion);
  });

  test('description meta is stamped with the same version as the page title', async ({ page }) => {
    await page.goto('/vBrand/');
    const titleVersion = extractVersion(await page.title());
    const descContent = await page.evaluate(
      () => document.querySelector('meta[name="description"]')?.getAttribute('content') ?? '',
    );
    expect(extractVersion(descContent)).toBe(titleVersion);
  });

  test('exactly one version label element exists in the nav', async ({ page }) => {
    await page.goto('/vBrand/');
    await expect(page.locator('[data-version-label]')).toHaveCount(1);
  });
});
