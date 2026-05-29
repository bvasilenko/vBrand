// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { ensureDir } from '../fs.js';
import { DegradationEntry } from './candidate-schema.js';

const MAX_ASSET_BYTES = 10 * 1024 * 1024;

const MIME_TO_EXT: Record<string, string> = {
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
};

export interface AssetCacheHit {
  kind: 'hit';
  localPath: string;
}

export interface AssetCacheMiss {
  kind: 'miss';
  reason: 'download-failed' | 'blocked' | 'oversize';
  detail: string;
}

export type AssetCacheResult = AssetCacheHit | AssetCacheMiss;

export interface CacheOutcome {
  result: AssetCacheResult;
  degradation?: DegradationEntry;
}

export function isDataUri(url: string): boolean {
  return url.startsWith('data:');
}

export async function cacheAsset(
  assetUrl: string,
  cacheDir: string,
  fieldLabel: string,
): Promise<CacheOutcome> {
  ensureDir(cacheDir);

  if (isDataUri(assetUrl)) {
    const localPath = materializeDataUri(assetUrl, cacheDir, fieldLabel);
    return { result: { kind: 'hit', localPath } };
  }

  const filename = deriveFilename(assetUrl);
  const provisionalPath = join(cacheDir, filename);
  const etagPath = `${provisionalPath}.etag`;

  const headers: Record<string, string> = { 'User-Agent': 'vbrand/0.2.0' };
  const storedEtag =
    existsSync(etagPath) && existsSync(provisionalPath)
      ? readFileSync(etagPath, 'utf-8').trim()
      : undefined;
  if (storedEtag) headers['If-None-Match'] = storedEtag;

  let response: Response;
  try {
    response = await fetch(assetUrl, { headers });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return {
      result: { kind: 'miss', reason: 'download-failed', detail },
      degradation: { step: `asset:${fieldLabel}`, reason: 'download-failed', detail },
    };
  }

  if (response.status === 304 && existsSync(provisionalPath)) {
    return { result: { kind: 'hit', localPath: provisionalPath } };
  }

  if (response.status === 403 || response.status === 429) {
    const detail = `HTTP ${response.status}`;
    return {
      result: { kind: 'miss', reason: 'blocked', detail },
      degradation: { step: `asset:${fieldLabel}`, reason: 'blocked-on-fetch', detail },
    };
  }

  if (!response.ok) {
    const detail = `HTTP ${response.status}`;
    return {
      result: { kind: 'miss', reason: 'download-failed', detail },
      degradation: { step: `asset:${fieldLabel}`, reason: 'download-failed', detail },
    };
  }

  const contentType = response.headers.get('content-type') ?? '';
  const resolvedFilename = withCorrectExtension(filename, contentType);
  const localPath = join(cacheDir, resolvedFilename);

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > MAX_ASSET_BYTES) {
    return {
      result: { kind: 'miss', reason: 'oversize', detail: `${buffer.byteLength} bytes` },
      degradation: {
        step: `asset:${fieldLabel}`,
        reason: 'download-failed',
        detail: `oversize: ${buffer.byteLength} bytes`,
      },
    };
  }

  writeFileSync(localPath, buffer);
  const etag = response.headers.get('etag');
  if (etag) writeFileSync(`${localPath}.etag`, etag, 'utf-8');

  return { result: { kind: 'hit', localPath } };
}

function deriveFilename(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const segments = pathname.split('/').filter(Boolean);
    const last = segments[segments.length - 1] ?? 'asset';
    return last.replace(/[^a-z0-9._-]/gi, '_').slice(0, 80) || 'asset';
  } catch {
    return 'asset';
  }
}

function withCorrectExtension(filename: string, contentType: string): string {
  if (extname(filename)) return filename;
  const mime = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
  const ext = MIME_TO_EXT[mime];
  return ext ? `${filename}.${ext}` : filename;
}

function materializeDataUri(dataUri: string, cacheDir: string, fieldLabel: string): string {
  const match = /^data:([^;,]+)(?:;base64)?,(.*)$/s.exec(dataUri);
  if (!match) {
    const fallback = join(cacheDir, `${fieldLabel}.bin`);
    writeFileSync(fallback, Buffer.alloc(0));
    return fallback;
  }
  const mime = match[1] as string;
  const content = match[2] as string;
  const ext = MIME_TO_EXT[mime.trim().toLowerCase()] ?? 'bin';
  const localPath = join(cacheDir, `${fieldLabel}.${ext}`);
  const isBase64 = dataUri.includes(';base64,');
  writeFileSync(
    localPath,
    isBase64 ? Buffer.from(content, 'base64') : Buffer.from(content, 'utf-8'),
  );
  return localPath;
}
