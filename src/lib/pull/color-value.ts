// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko

const EXACT_HEX_RE = /^#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})$/;
const RGB_RE = /^rgba?\([^)]+\)$/;

export function normalizeHex(raw: string): string | undefined {
  const t = raw.trim();
  return EXACT_HEX_RE.test(t) ? t : undefined;
}

export function isColorValue(raw: string): boolean {
  const t = raw.trim();
  return EXACT_HEX_RE.test(t) || RGB_RE.test(t);
}
