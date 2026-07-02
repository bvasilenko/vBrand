// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { test, expect, type Page } from '@playwright/test';

const VIEWPORT_CASES = [
  { label: 'mobile',  width: 390,  height: 844 },
  { label: 'laptop',  width: 1024, height: 768 },
  { label: 'desktop', width: 1440, height: 900 },
] as const;

const NAV_CONTROLS = [
  { selector: '[data-nav-brand-input]', label: 'brand input' },
  { selector: '[data-axis="app"]',      label: 'app-type select' },
  { selector: '[data-axis="mode"]',     label: 'mode select' },
  { selector: '[data-axis="stack"]',    label: 'stack select' },
  { selector: '[data-axis="cms"]',      label: 'cms select' },
] as const;

const LAYOUT_PANELS = [
  { selector: '[aria-label="Composition sections"]',       label: 'composition editor' },
  { selector: '[data-panel="content-editor"]',             label: 'content editor' },
  { selector: '[aria-label="Deployment target contract"]', label: 'deploy panel' },
] as const;

const READY_TIMEOUT = 15_000;

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => document.documentElement.style.getPropertyValue('--color-primary').trim() !== '',
    { timeout: READY_TIMEOUT },
  );
}

async function assertWithinViewport(
  page: Page,
  selector: string,
  viewport: { width: number; height: number },
): Promise<void> {
  const locator = page.locator(selector);
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box, `${selector} must have a layout box`).not.toBeNull();
  expect(box!.x, `left of ${selector} must not be off-screen left`).toBeGreaterThanOrEqual(0);
  expect(box!.y, `top of ${selector} must not be above viewport top`).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width, `right of ${selector} must not exceed viewport width`).toBeLessThanOrEqual(viewport.width);
  expect(box!.y + box!.height, `bottom of ${selector} must not exceed viewport height`).toBeLessThanOrEqual(viewport.height);
}

for (const { label, width, height } of VIEWPORT_CASES) {
  test.describe(`${label} ${width}x${height}`, () => {
    test.use({ viewport: { width, height } });

    test.beforeEach(async ({ page }) => {
      await page.goto('/vBrand/');
      await waitForReady(page);
    });

    test('layout has no horizontal overflow', async ({ page }) => {
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth).toBeLessThanOrEqual(width);
    });

    for (const { selector, label: controlLabel } of NAV_CONTROLS) {
      test(`${controlLabel} is within viewport in nav`, async ({ page }) => {
        await assertWithinViewport(page, selector, { width, height });
      });
    }

    for (const { selector, label: panelLabel } of LAYOUT_PANELS) {
      test(`${panelLabel} is visible in the layout`, async ({ page }) => {
        await expect(page.locator(selector)).toBeVisible();
      });
    }

    test('each axis nav control exists exactly once in the DOM', async ({ page }) => {
      for (const axis of ['app', 'mode', 'stack', 'cms'] as const) {
        await expect(page.locator(`[data-axis="${axis}"]`)).toHaveCount(1);
      }
    });
  });
}
