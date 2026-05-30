// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import vthemePreset from '@booga/vtheme/preset';
import { dslSafelist } from '@booga/vdsl';

/** @type {import('tailwindcss').Config} */
export default {
  presets: [vthemePreset],
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
    './node_modules/@booga/vblocks/dist/**/*.js',
    './node_modules/@booga/vui/dist/**/*.js',
  ],
  // vDsl prop-to-className conversion happens at runtime (e.g. <DGrid px={6} py={24} gap={12} />
  // becomes className="px-6 py-24 gap-12") so Tailwind's static scanner cannot detect those
  // utilities from source. dslSafelist enumerates every prop-derived class for safelisting.
  safelist: dslSafelist,
};
