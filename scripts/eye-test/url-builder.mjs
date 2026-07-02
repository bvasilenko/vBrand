// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko

const DEMO_PATH = '/vBrand/';

export function cellToUrl(cell, baseUrl) {
  const origin = new URL(baseUrl).origin;
  const u = new URL(DEMO_PATH, origin);
  u.searchParams.set('brand', `fixture:${cell.fixture}`);
  u.searchParams.set('app',   cell.app);
  u.searchParams.set('mode',  cell.mode);
  if (cell.stack !== undefined) u.searchParams.set('stack', cell.stack);
  u.searchParams.set('cms',   cell.cms);
  return u.toString();
}
