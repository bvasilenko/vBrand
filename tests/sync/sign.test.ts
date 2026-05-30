// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { describe, expect, it } from 'vitest';
import { generateKeyPair, signBytes, verifyBytes } from '../../src/lib/sync/sign.js';

const BASE64_RE = /^[A-Za-z0-9+/]+=*$/;

describe('generateKeyPair', () => {
  it('returns non-empty base64-encoded public and private keys', () => {
    const kp = generateKeyPair();
    expect(kp.publicKeyBase64).toMatch(BASE64_RE);
    expect(kp.privateKeyBase64).toMatch(BASE64_RE);
  });

  it('successive calls produce distinct key pairs', () => {
    const a = generateKeyPair();
    const b = generateKeyPair();
    expect(a.publicKeyBase64).not.toBe(b.publicKeyBase64);
    expect(a.privateKeyBase64).not.toBe(b.privateKeyBase64);
  });
});

describe('signBytes + verifyBytes', () => {
  it('signature of a buffer verifies against the matching public key', () => {
    const kp = generateKeyPair();
    const data = Buffer.from('hello world');
    const sig = signBytes(data, kp.privateKeyBase64);
    expect(verifyBytes(data, sig, kp.publicKeyBase64)).toBe(true);
  });

  it('signature does not verify against a different key pair', () => {
    const kpA = generateKeyPair();
    const kpB = generateKeyPair();
    const data = Buffer.from('hello world');
    const sig = signBytes(data, kpA.privateKeyBase64);
    expect(verifyBytes(data, sig, kpB.publicKeyBase64)).toBe(false);
  });

  it('one-byte mutation in the signed data causes verification to fail', () => {
    const kp = generateKeyPair();
    const data = Buffer.from('hello world');
    const sig = signBytes(data, kp.privateKeyBase64);
    const tampered = Buffer.from(data);
    tampered[0] ^= 0xff;
    expect(verifyBytes(tampered, sig, kp.publicKeyBase64)).toBe(false);
  });

  it('one-byte mutation in the signature causes verification to fail', () => {
    const kp = generateKeyPair();
    const data = Buffer.from('hello world');
    const sig = signBytes(data, kp.privateKeyBase64);
    const tamperedSig = Buffer.from(sig, 'base64');
    tamperedSig[0] ^= 0xff;
    expect(verifyBytes(data, tamperedSig.toString('base64'), kp.publicKeyBase64)).toBe(false);
  });

  it('empty signature string returns false without throwing', () => {
    const kp = generateKeyPair();
    const data = Buffer.from('data');
    expect(verifyBytes(data, '', kp.publicKeyBase64)).toBe(false);
  });

  it('empty buffer can be signed and verified', () => {
    const kp = generateKeyPair();
    const data = Buffer.alloc(0);
    const sig = signBytes(data, kp.privateKeyBase64);
    expect(verifyBytes(data, sig, kp.publicKeyBase64)).toBe(true);
  });

  it('large buffer can be signed and verified', () => {
    const kp = generateKeyPair();
    const data = Buffer.alloc(100_000, 0xab);
    const sig = signBytes(data, kp.privateKeyBase64);
    expect(verifyBytes(data, sig, kp.publicKeyBase64)).toBe(true);
  });
});
