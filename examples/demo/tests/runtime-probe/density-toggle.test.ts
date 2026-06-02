// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { test, expect } from '@playwright/test';

const BASE = '/vBrand/';
const HERO_COMPACT  = '[data-section-id="hero"] [data-density="compact"]';
const HERO_SPACIOUS = '[data-section-id="hero"] [data-density="spacious"]';
const HERO_REGULAR  = '[data-section-id="hero"] [data-density="regular"]';

test('density chip clicks update window.location.hash via composition hash-sync', async ({ page }) => {
  await page.goto(`${BASE}?app=landing`);

  await page.waitForFunction(
    () => document.documentElement.style.getPropertyValue('--color-primary').trim() !== '',
    { timeout: 10_000 },
  );

  await expect(page.locator(HERO_COMPACT)).toBeVisible({ timeout: 5_000 });

  const baselineHash = await page.evaluate(() => window.location.hash);

  await page.click(HERO_COMPACT);
  const afterCompact = await page.evaluate(() => window.location.hash);
  expect(afterCompact).not.toBe(baselineHash);
  expect(afterCompact.length).toBeGreaterThan(0);

  await page.click(HERO_SPACIOUS);
  const afterSpacious = await page.evaluate(() => window.location.hash);
  expect(afterSpacious).not.toBe(afterCompact);

  await page.click(HERO_REGULAR);
  const afterRegular = await page.evaluate(() => window.location.hash);
  expect(afterRegular).not.toBe(afterSpacious);
  expect(afterRegular).not.toBe(afterCompact);
});

test('compact chip click encodes density:compact into the composition hash', async ({ page }) => {
  await page.goto(`${BASE}?app=landing`);

  await page.waitForFunction(
    () => document.documentElement.style.getPropertyValue('--color-primary').trim() !== '',
    { timeout: 10_000 },
  );

  await expect(page.locator(HERO_COMPACT)).toBeVisible({ timeout: 5_000 });
  await page.click(HERO_COMPACT);

  const rawHash = await page.evaluate(() => window.location.hash);
  const spec = await page.evaluate(
    (hash) => {
      const encoded = hash.replace(/^#composition=/, '');
      if (!encoded || encoded === hash) return null;
      try { return JSON.parse(atob(encoded)); } catch { return null; }
    },
    rawHash,
  ) as { sections: Array<{ id: string; density: string }> } | null;

  expect(spec).not.toBeNull();
  const hero = spec?.sections.find((s) => s.id === 'hero');
  expect(hero?.density).toBe('compact');
});

test('active density chip has aria-pressed=true; inactive chips have aria-pressed=false', async ({ page }) => {
  await page.goto(`${BASE}?app=landing`);

  await page.waitForFunction(
    () => document.documentElement.style.getPropertyValue('--color-primary').trim() !== '',
    { timeout: 10_000 },
  );

  await expect(page.locator(HERO_COMPACT)).toBeVisible({ timeout: 5_000 });
  await page.click(HERO_COMPACT);

  await expect(page.locator(HERO_COMPACT)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator(HERO_SPACIOUS)).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator(HERO_REGULAR)).toHaveAttribute('aria-pressed', 'false');

  await page.click(HERO_SPACIOUS);

  await expect(page.locator(HERO_SPACIOUS)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator(HERO_COMPACT)).toHaveAttribute('aria-pressed', 'false');
});
