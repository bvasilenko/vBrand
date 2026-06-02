// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { test, expect } from '@playwright/test';

const BASE = '/vBrand/';
const INDIGO_FALLBACK = '#6366f1';

const FIXTURE_PRIMARY_COLORS: ReadonlyArray<[string, string]> = [
  ['stripe',  '#635BFF'],
  ['vercel',  '#000000'],
  ['linear',  '#5E6AD2'],
  ['github',  '#2DA44E'],
  ['notion',  '#000000'],
];

const FIXTURE_HEADING_FONTS: ReadonlyArray<[string, string]> = [
  ['stripe',  '"Ideal Sans", system-ui, sans-serif'],
  ['vercel',  '"Geist Sans", system-ui, sans-serif'],
  ['linear',  '"Inter", system-ui, sans-serif'],
  ['github',  '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'],
  ['notion',  'ui-sans-serif, system-ui, sans-serif'],
];

for (const [handle, expectedPrimary] of FIXTURE_PRIMARY_COLORS) {
  test(`fixture:${handle} sets --color-primary=${expectedPrimary} on :root`, async ({ page }) => {
    await page.goto(`${BASE}?brand=fixture:${handle}`);

    await page.waitForFunction(
      () => document.documentElement.style.getPropertyValue('--color-primary').trim() !== '',
      { timeout: 10_000 },
    );

    const primary = await page.evaluate(
      () => document.documentElement.style.getPropertyValue('--color-primary').trim(),
    );

    expect(primary).toBe(expectedPrimary);
    expect(primary).not.toBe(INDIGO_FALLBACK);
  });
}

for (const [handle, expectedFont] of FIXTURE_HEADING_FONTS) {
  test(`fixture:${handle} sets --type-heading to its brand font on :root`, async ({ page }) => {
    await page.goto(`${BASE}?brand=fixture:${handle}`);

    await page.waitForFunction(
      () => document.documentElement.style.getPropertyValue('--type-heading').trim() !== '',
      { timeout: 10_000 },
    );

    const font = await page.evaluate(
      () => document.documentElement.style.getPropertyValue('--type-heading').trim(),
    );

    expect(font).toBe(expectedFont);
    expect(font.length).toBeGreaterThan(0);
  });
}

test('different fixtures produce distinct --color-primary values', async ({ page }) => {
  async function getPrimary(handle: string): Promise<string> {
    await page.goto(`${BASE}?brand=fixture:${handle}`);
    await page.waitForFunction(
      () => document.documentElement.style.getPropertyValue('--color-primary').trim() !== '',
      { timeout: 10_000 },
    );
    return page.evaluate(
      () => document.documentElement.style.getPropertyValue('--color-primary').trim(),
    );
  }

  const stripePrimary = await getPrimary('stripe');
  const linearPrimary = await getPrimary('linear');
  const githubPrimary = await getPrimary('github');

  expect(stripePrimary).not.toBe(linearPrimary);
  expect(stripePrimary).not.toBe(githubPrimary);
  expect(linearPrimary).not.toBe(githubPrimary);
});
