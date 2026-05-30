// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { describe, expect, it } from 'vitest';
import { digestJson, digestBytes } from '../../src/lib/sync/digest.js';

const SHA256_HEX_RE = /^[0-9a-f]{64}$/;

describe('digestJson — canonical hash', () => {
  it('produces a 64-character lowercase hex string', () => {
    expect(digestJson({ name: 'test' })).toMatch(SHA256_HEX_RE);
  });

  it('same value produces an identical digest on every call', () => {
    const v = { tokens: { color: { primary: '#0f172a' } }, name: 'x' };
    expect(digestJson(v)).toBe(digestJson(v));
  });

  it('key insertion order does not change digest', () => {
    const a = { name: 'brand', tokens: { color: '#fff' } };
    const b = { tokens: { color: '#fff' }, name: 'brand' };
    expect(digestJson(a)).toBe(digestJson(b));
  });

  it('nested key order does not change digest', () => {
    const a = { tokens: { color: '#0f172a', accent: '#6366f1' } };
    const b = { tokens: { accent: '#6366f1', color: '#0f172a' } };
    expect(digestJson(a)).toBe(digestJson(b));
  });

  it('different values produce different digests', () => {
    expect(digestJson({ name: 'a' })).not.toBe(digestJson({ name: 'b' }));
  });

  it('array element order is significant: reversed array changes digest', () => {
    const fwd = { sizes: [16, 32, 64] };
    const rev = { sizes: [64, 32, 16] };
    expect(digestJson(fwd)).not.toBe(digestJson(rev));
  });

  it('handles null value', () => {
    expect(digestJson(null)).toMatch(SHA256_HEX_RE);
  });

  it('handles string, number, and boolean primitives', () => {
    expect(digestJson('hello')).toMatch(SHA256_HEX_RE);
    expect(digestJson(42)).toMatch(SHA256_HEX_RE);
    expect(digestJson(true)).toMatch(SHA256_HEX_RE);
    expect(digestJson('hello')).not.toBe(digestJson(42));
    expect(digestJson(42)).not.toBe(digestJson(true));
  });

  it('empty object and empty array have distinct digests', () => {
    expect(digestJson({})).not.toBe(digestJson([]));
  });

  it('deep nesting with reordered keys produces the same digest', () => {
    const a = { a: { b: { c: { x: 1, y: 2 } } } };
    const b = { a: { b: { c: { y: 2, x: 1 } } } };
    expect(digestJson(a)).toBe(digestJson(b));
  });
});

describe('digestBytes — raw sha256', () => {
  it('produces a 64-character lowercase hex string', () => {
    expect(digestBytes(Buffer.from('hello'))).toMatch(SHA256_HEX_RE);
  });

  it('different byte sequences produce different digests', () => {
    expect(digestBytes(Buffer.from('hello'))).not.toBe(digestBytes(Buffer.from('world')));
  });

  it('same byte sequence always produces the same digest', () => {
    const b = Buffer.from('stable');
    expect(digestBytes(b)).toBe(digestBytes(b));
  });

  it('empty buffer produces a fixed digest', () => {
    const d = digestBytes(Buffer.alloc(0));
    expect(d).toMatch(SHA256_HEX_RE);
    expect(digestBytes(Buffer.alloc(0))).toBe(d);
  });

  it('is consistent with digestJson for primitive values (no key ordering involved)', () => {
    const value = 'round-trip';
    const via = digestBytes(Buffer.from(JSON.stringify(value), 'utf-8'));
    expect(via).toBe(digestJson(value));
  });
});
