// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { test, expect } from '@playwright/test';

const PREVIEW_URL = `http://localhost:${process.env['PREVIEW_PORT'] ?? '5290'}`;
const BASE = `${PREVIEW_URL}/vBrand`;

test('data-route-status: /data direct URL returns 200 OK', async ({ page }) => {
  const response = await page.goto(`${BASE}/data`);
  expect(response?.status()).toBe(200);
});

test('data-route-status: /data response contains SPA shell markup', async ({ page }) => {
  const response = await page.goto(`${BASE}/data`);
  expect(response?.status()).toBe(200);
  const body = await page.content();
  expect(body).toContain('<div id="root">');
});
