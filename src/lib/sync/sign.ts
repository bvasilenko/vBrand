// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import {
  generateKeyPairSync,
  sign as cryptoSign,
  verify as cryptoVerify,
} from 'node:crypto';

export interface KeyPair {
  publicKeyBase64: string;
  privateKeyBase64: string;
}

export function generateKeyPair(): KeyPair {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'der' },
  });
  return {
    publicKeyBase64: publicKey.toString('base64'),
    privateKeyBase64: privateKey.toString('base64'),
  };
}

export function signBytes(data: Buffer, privateKeyBase64: string): string {
  const privateKeyDer = Buffer.from(privateKeyBase64, 'base64');
  const keyObject = { key: privateKeyDer, format: 'der' as const, type: 'pkcs8' as const };
  const sig = cryptoSign(null, data, keyObject);
  return sig.toString('base64');
}

export function verifyBytes(
  data: Buffer,
  signatureBase64: string,
  publicKeyBase64: string,
): boolean {
  try {
    const publicKeyDer = Buffer.from(publicKeyBase64, 'base64');
    const keyObject = { key: publicKeyDer, format: 'der' as const, type: 'spki' as const };
    const sig = Buffer.from(signatureBase64, 'base64');
    return cryptoVerify(null, data, keyObject, sig);
  } catch {
    return false;
  }
}
