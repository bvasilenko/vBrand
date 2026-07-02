// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { expect, test } from '@playwright/test';
import { FIXTURE_SLUGS } from '@booga/vfixtures';

const APPS = ['landing', 'marketing', 'docs', 'dashboard'];
const CMS = ['vbrand-standalone', 'payload', 'sanity', 'strapi'];

test.describe('cms-axis probe', () => {
  for (const fixture of FIXTURE_SLUGS) {
    for (const app of APPS) {
      test(`${fixture}/${app} normalizes content across CMS substrates`, async ({ page }) => {
        const snapshots: unknown[] = [];
        for (const cms of CMS) {
          await page.goto(`/vBrand/?brand=fixture:${fixture}&app=${app}&cms=${cms}`);
          await expect(page.locator('body')).toContainText('CMS substrate');
          snapshots.push(await page.evaluate(() => window.__vbrand_content_tree__));
        }
        for (const snapshot of snapshots.slice(1)) expect(snapshot).toEqual(snapshots[0]);
      });
    }
  }
});

test.describe('cms-axis brand-fixture variation', () => {
  test('distinct brand fixtures yield distinct content trees across every CMS substrate', async ({ page }) => {
    const [firstFixture, secondFixture] = FIXTURE_SLUGS;
    for (const cms of CMS) {
      await page.goto(`/vBrand/?brand=fixture:${firstFixture}&app=landing&cms=${cms}`);
      await expect(page.locator('body')).toContainText('CMS substrate');
      const firstTree = await page.evaluate(() => window.__vbrand_content_tree__);

      await page.goto(`/vBrand/?brand=fixture:${secondFixture}&app=landing&cms=${cms}`);
      await expect(page.locator('body')).toContainText('CMS substrate');
      const secondTree = await page.evaluate(() => window.__vbrand_content_tree__);

      expect(firstTree).not.toEqual(secondTree);
    }
  });
});
