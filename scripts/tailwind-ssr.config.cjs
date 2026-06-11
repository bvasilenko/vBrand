// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
// CJS format required by Tailwind v3 config loader.
const path = require('path');
const vthemePreset = require('@booga/vtheme/preset');
const { dslSafelist } = require('@booga/vdsl');

const root = path.resolve(__dirname, '..');

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [vthemePreset.default ?? vthemePreset],
  content: [
    path.join(root, 'src/**/*.{ts,tsx}'),
    path.join(root, 'node_modules/@booga/vblocks/dist/**/*.js'),
    path.join(root, 'node_modules/@booga/vui/dist/**/*.js'),
  ],
  safelist: dslSafelist,
};
