// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko

export class CorsBlockedError extends Error {
  readonly url: string;

  constructor(url: string) {
    super(
      `CORS policy blocked fetch from "${url}". ` +
      `Try vbrand pull <url> locally, or use a fixture: prefix.`,
    );
    this.name = 'CorsBlockedError';
    this.url = url;
  }
}

export function isCrossOrigin(url: string): boolean {
  try {
    const requestOrigin = new URL(url).origin;
    const pageOrigin =
      typeof globalThis !== 'undefined' &&
      'location' in globalThis &&
      typeof (globalThis as { location?: { origin?: string } }).location?.origin === 'string'
        ? (globalThis as { location: { origin: string } }).location.origin
        : null;
    return pageOrigin === null || requestOrigin !== pageOrigin;
  } catch {
    return true;
  }
}

const CORS_FETCH_ERROR_SIGNATURES: readonly string[] = [
  'Failed to fetch',
  'NetworkError',
  'Load failed',
];

function looksLikeCorsError(error: TypeError): boolean {
  return CORS_FETCH_ERROR_SIGNATURES.some((sig) => error.message.includes(sig));
}

export function classifyFetchError(url: string, error: unknown): Error {
  if (!(error instanceof TypeError)) {
    return error instanceof Error ? error : new Error(String(error));
  }
  if (looksLikeCorsError(error) && isCrossOrigin(url)) {
    return new CorsBlockedError(url);
  }
  return error;
}
