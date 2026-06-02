// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CorsBlockedError, isCrossOrigin, classifyFetchError } from '../../../src/adapters/brand-source/cors-error.js';

const KNOWN_CORS_MESSAGES = [
  'Failed to fetch',
  'NetworkError when attempting to fetch resource',
  'Load failed',
] as const;

const NON_CORS_TYPEERROR_MESSAGES = [
  'Invalid URL',
  'The operation was aborted',
  '',
] as const;

beforeEach(() => {
  vi.stubGlobal('location', undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CorsBlockedError: class contract', () => {
  it('is an instance of Error', () => {
    expect(new CorsBlockedError('https://stripe.com')).toBeInstanceOf(Error);
  });

  it('url property equals the constructor argument verbatim', () => {
    expect(new CorsBlockedError('https://stripe.com').url).toBe('https://stripe.com');
  });

  it('message includes the URL so the user can identify the blocked request', () => {
    expect(new CorsBlockedError('https://stripe.com').message).toContain('https://stripe.com');
  });

  it('name is "CorsBlockedError" (distinguishable from generic Error)', () => {
    expect(new CorsBlockedError('https://x.com').name).toBe('CorsBlockedError');
  });

  it('message mentions vbrand pull so the user knows the local alternative', () => {
    expect(new CorsBlockedError('https://x.com').message).toMatch(/vbrand pull/i);
  });
});

describe('classifyFetchError: non-TypeError error passthrough', () => {
  it('a plain Error is returned as the original reference (not wrapped)', () => {
    const original = new Error('HTTP 500');
    expect(classifyFetchError('https://stripe.com', original)).toBe(original);
  });

  it('a non-Error unknown is wrapped in a plain Error, not a CorsBlockedError', () => {
    const result = classifyFetchError('https://stripe.com', 'some string error');
    expect(result).toBeInstanceOf(Error);
    expect(result).not.toBeInstanceOf(CorsBlockedError);
  });
});

describe('classifyFetchError: CORS-indicating TypeError on cross-origin URL yields CorsBlockedError', () => {
  it.each([...KNOWN_CORS_MESSAGES])(
    'TypeError with message "%s" yields CorsBlockedError carrying the original URL',
    (msg) => {
      const result = classifyFetchError('https://stripe.com', new TypeError(msg));
      expect(result).toBeInstanceOf(CorsBlockedError);
      expect((result as CorsBlockedError).url).toBe('https://stripe.com');
    },
  );

  it('TypeError with CORS-indicating message when window.location is absent yields CorsBlockedError (conservative fallback)', () => {
    const result = classifyFetchError('https://stripe.com', new TypeError('Failed to fetch'));
    expect(result).toBeInstanceOf(CorsBlockedError);
  });
});

describe('classifyFetchError: non-CORS TypeError on cross-origin URL is returned as-is', () => {
  it.each([...NON_CORS_TYPEERROR_MESSAGES])(
    'TypeError with message "%s" is returned as the original reference',
    (msg) => {
      const original = new TypeError(msg);
      const result = classifyFetchError('https://stripe.com', original);
      expect(result).not.toBeInstanceOf(CorsBlockedError);
      expect(result).toBe(original);
    },
  );
});

describe('classifyFetchError: origin boundary gates TypeError promotion', () => {
  it('TypeError on a same-origin URL is returned as-is (not promoted to CorsBlockedError)', () => {
    vi.stubGlobal('location', { origin: 'https://stripe.com' });
    const err = classifyFetchError('https://stripe.com/api/data', new TypeError('Failed to fetch'));
    expect(err).not.toBeInstanceOf(CorsBlockedError);
  });

  it('TypeError on a cross-origin URL yields CorsBlockedError (origins differ)', () => {
    vi.stubGlobal('location', { origin: 'https://bvasilenko.github.io' });
    const result = classifyFetchError('https://stripe.com', new TypeError('Failed to fetch'));
    expect(result).toBeInstanceOf(CorsBlockedError);
    expect((result as CorsBlockedError).url).toBe('https://stripe.com');
  });

  it('TypeError for an unparseable URL yields CorsBlockedError (conservative: cannot confirm same-origin)', () => {
    const result = classifyFetchError('not-a-url', new TypeError('Failed to fetch'));
    expect(result).toBeInstanceOf(CorsBlockedError);
  });

  it('TypeError for a relative path yields CorsBlockedError (conservative: no absolute origin to compare)', () => {
    const result = classifyFetchError('/api/data', new TypeError('Failed to fetch'));
    expect(result).toBeInstanceOf(CorsBlockedError);
  });
});

describe('isCrossOrigin: origin boundary detection', () => {
  it('returns true when globalThis.location is absent (no page context)', () => {
    expect(isCrossOrigin('https://stripe.com')).toBe(true);
  });

  it('returns false when URL origin exactly matches location.origin', () => {
    vi.stubGlobal('location', { origin: 'https://stripe.com' });
    expect(isCrossOrigin('https://stripe.com/some/path?q=1')).toBe(false);
  });

  it('returns true when URL origin differs from location.origin', () => {
    vi.stubGlobal('location', { origin: 'https://bvasilenko.github.io' });
    expect(isCrossOrigin('https://stripe.com')).toBe(true);
  });

  it('returns true for a subdomain even when the apex domain matches location.origin', () => {
    vi.stubGlobal('location', { origin: 'https://stripe.com' });
    expect(isCrossOrigin('https://api.stripe.com/v1/data')).toBe(true);
  });

  it('returns true when scheme differs from location.origin (http vs https)', () => {
    vi.stubGlobal('location', { origin: 'https://stripe.com' });
    expect(isCrossOrigin('http://stripe.com')).toBe(true);
  });

  it('returns true when port differs from location.origin (same host, different port)', () => {
    vi.stubGlobal('location', { origin: 'https://stripe.com' });
    expect(isCrossOrigin('https://stripe.com:8080/path')).toBe(true);
  });

  it('returns true when location.origin is the string "null" (sandboxed iframe or file:// context)', () => {
    vi.stubGlobal('location', { origin: 'null' });
    expect(isCrossOrigin('https://stripe.com')).toBe(true);
  });

  it('returns true for an unparseable URL (conservative: cannot confirm same-origin)', () => {
    expect(isCrossOrigin('not-a-valid-url')).toBe(true);
  });

  it('returns true for a relative path (no absolute origin available to compare)', () => {
    expect(isCrossOrigin('/api/data')).toBe(true);
  });
});
