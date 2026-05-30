// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { digestJson } from '../../src/lib/sync/digest.js';
import { signBytes } from '../../src/lib/sync/sign.js';
import { writeBundleToDir } from '../../src/lib/sync/bundle-io.js';
import type { KeyPair } from '../../src/lib/sync/sign.js';
import type { SyncHead } from '../../src/lib/sync/types.js';

export type { KeyPair };

export const UMBRELLA_SCHEMA = {
  name: 'umbrella',
  voice: { canonical: 'Umbrella.', repoDescription: 'Umbrella brand.' },
  assets: {
    favicon: { source: 'logo.png', sizes: [32] },
    og: { dimensions: [1200, 630] },
    icons: { source: 'icons/', set: [] },
  },
  tokens: { color: { primary: '#0f172a' }, type: {} },
};

export function makeTmpDir(prefix = 'vbrand-test-'): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

export function publishBundle(distDir: string, schema: object, kp: KeyPair): string {
  mkdirSync(distDir, { recursive: true });
  const digest = digestJson(schema);
  const head: SyncHead = {
    digest,
    publishedAt: new Date().toISOString(),
    publicKey: kp.publicKeyBase64,
  };
  const headBytes = Buffer.from(JSON.stringify(head, null, 2) + '\n', 'utf-8');
  writeBundleToDir(
    distDir,
    head,
    signBytes(headBytes, kp.privateKeyBase64),
    JSON.stringify(schema, null, 2) + '\n',
  );
  return `file://${distDir}`;
}

export function writeSeedSchema(dir: string, schema: object = UMBRELLA_SCHEMA): void {
  writeFileSync(join(dir, 'vbrand.schema.json'), JSON.stringify(schema, null, 2) + '\n');
}
