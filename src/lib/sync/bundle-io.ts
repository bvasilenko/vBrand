// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ensureDir } from '../fs.js';
import type { SyncHead } from './types.js';

export const HEAD_FILENAME = 'head.json';
export const HEAD_SIG_FILENAME = 'head.json.sig';
export const BY_DIGEST_DIR = 'by-digest';

export interface BundleFiles {
  headPath: string;
  headSigPath: string;
  bundlePath: string;
}

export function writeBundleToDir(
  outDir: string,
  head: SyncHead,
  headSigBase64: string,
  bundleJson: string,
): BundleFiles {
  ensureDir(outDir);
  ensureDir(join(outDir, BY_DIGEST_DIR));

  const headPath = join(outDir, HEAD_FILENAME);
  const headSigPath = join(outDir, HEAD_SIG_FILENAME);
  const bundlePath = join(outDir, BY_DIGEST_DIR, `${head.digest}.json`);

  writeFileSync(headPath, JSON.stringify(head, null, 2) + '\n', 'utf-8');
  writeFileSync(headSigPath, headSigBase64 + '\n', 'utf-8');
  writeFileSync(bundlePath, bundleJson, 'utf-8');

  return { headPath, headSigPath, bundlePath };
}

async function resolveUrl(baseUrl: string, relative: string): Promise<Buffer> {
  const fullUrl = baseUrl.endsWith('/') ? baseUrl + relative : `${baseUrl}/${relative}`;

  if (fullUrl.startsWith('file://')) {
    const fsPath = fullUrl.slice('file://'.length);
    return readFileSync(fsPath);
  }

  const resp = await fetch(fullUrl);
  if (!resp.ok) {
    throw new Error(
      `Sync distribution endpoint returned ${resp.status} for: ${fullUrl}`,
    );
  }
  return Buffer.from(await resp.arrayBuffer());
}

export async function fetchHead(baseUrl: string): Promise<{ head: SyncHead; headBytes: Buffer }> {
  const headBytes = await resolveUrl(baseUrl, HEAD_FILENAME);
  const head = JSON.parse(headBytes.toString('utf-8')) as SyncHead;
  return { head, headBytes };
}

export async function fetchHeadSig(baseUrl: string): Promise<string> {
  const sigBytes = await resolveUrl(baseUrl, HEAD_SIG_FILENAME);
  return sigBytes.toString('utf-8').trim();
}

export async function fetchBundleByDigest(
  baseUrl: string,
  digest: string,
): Promise<{ bundle: unknown; bundleBytes: Buffer }> {
  const bundleBytes = await resolveUrl(baseUrl, `${BY_DIGEST_DIR}/${digest}.json`);
  const bundle = JSON.parse(bundleBytes.toString('utf-8')) as unknown;
  return { bundle, bundleBytes };
}
