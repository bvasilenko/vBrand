// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { test, expect } from '@playwright/test';

const BASE = '/vBrand/';

test('/vBrand/data renders the data tab without a GitHub Pages 404', async ({ page }) => {
  await page.goto(`${BASE}data`);

  await expect(page.getByText('VbrandSchema valid', { exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('Did you mean', { exact: false })).not.toBeVisible();
});

test('/vBrand/random-path renders the SPA shell instead of a GitHub Pages 404', async ({ page }) => {
  await page.goto(`${BASE}random-path`);

  await expect(page.getByRole('navigation').filter({ hasText: 'Brand data' })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('Did you mean', { exact: false })).not.toBeVisible();
  await expect(page.getByText('404', { exact: true })).not.toBeVisible();
});

test('SPA nav bar exposes a "Brand data" link on every routable path', async ({ page }) => {
  for (const path of ['', 'data', 'random-path']) {
    await page.goto(`${BASE}${path}`);
    await expect(
      page.getByRole('navigation').filter({ hasText: 'Brand data' }),
    ).toBeVisible({ timeout: 10_000 });
  }
});
