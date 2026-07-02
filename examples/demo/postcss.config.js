// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function hasPackage(name) {
  try {
    require.resolve(name);
    return true;
  } catch {
    return false;
  }
}

const plugins = { tailwindcss: {} };
if (hasPackage('autoprefixer')) plugins.autoprefixer = {};

export default { plugins };
