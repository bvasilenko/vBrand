// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko

export type WcagGrade = 'AAA' | 'AA' | 'AA-large' | 'fail';

export interface ContrastResult {
  textHex: string;
  bgHex: string;
  wcagRatio: number;
  wcagGrade: WcagGrade;
  apcaLc: number;
  apcaAdequate: boolean;
}

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function hexToRgb(hex: string): Rgb {
  const clean = hex.replace(/^#/, '');
  const expanded =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const n = parseInt(expanded, 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

function sRGBtoLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function wcagRelativeLuminance({ r, g, b }: Rgb): number {
  return (
    0.2126 * sRGBtoLinear(r) +
    0.7152 * sRGBtoLinear(g) +
    0.0722 * sRGBtoLinear(b)
  );
}

export function wcagContrastRatio(fgHex: string, bgHex: string): number {
  const L1 = wcagRelativeLuminance(hexToRgb(fgHex));
  const L2 = wcagRelativeLuminance(hexToRgb(bgHex));
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

function wcagGrade(ratio: number): WcagGrade {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'AA-large';
  return 'fail';
}

const APCA_SCALE = 1.14;
const APCA_BG_EXP_LIGHT = 0.56;
const APCA_TEXT_EXP_LIGHT = 0.57;
const APCA_BG_EXP_DARK = 0.65;
const APCA_TEXT_EXP_DARK = 0.62;
const APCA_SOFT_CLIP = 0.022;
const APCA_SOFT_CLIP_POWER = 1.414;
const APCA_ADEQUATE_LC = 60;

function apcaLuminance({ r, g, b }: Rgb): number {
  const y =
    0.2126729 * sRGBtoLinear(r) +
    0.7151522 * sRGBtoLinear(g) +
    0.0721750 * sRGBtoLinear(b);
  return y < APCA_SOFT_CLIP ? y + (APCA_SOFT_CLIP - y) ** APCA_SOFT_CLIP_POWER : y;
}

export function apcaLcContrast(textHex: string, bgHex: string): number {
  const Yt = apcaLuminance(hexToRgb(textHex));
  const Yb = apcaLuminance(hexToRgb(bgHex));
  if (Math.abs(Yb - Yt) < 0.0005) return 0;
  const sapc =
    Yb > Yt
      ? (Yb ** APCA_BG_EXP_LIGHT - Yt ** APCA_TEXT_EXP_LIGHT) * APCA_SCALE
      : (Yb ** APCA_BG_EXP_DARK - Yt ** APCA_TEXT_EXP_DARK) * APCA_SCALE;
  return sapc * 100;
}

export function checkContrast(textHex: string, bgHex: string): ContrastResult {
  const wcagRatio = wcagContrastRatio(textHex, bgHex);
  const apcaLc = apcaLcContrast(textHex, bgHex);
  return {
    textHex,
    bgHex,
    wcagRatio: Math.round(wcagRatio * 100) / 100,
    wcagGrade: wcagGrade(wcagRatio),
    apcaLc: Math.round(apcaLc * 10) / 10,
    apcaAdequate: Math.abs(apcaLc) >= APCA_ADEQUATE_LC,
  };
}
