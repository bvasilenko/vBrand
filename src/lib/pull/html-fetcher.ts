// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { DegradationEntry } from './candidate-schema.js';

const USER_AGENT = 'vbrand/0.2.1';

export type FetchHtmlOutcome =
  | { ok: true; html: string }
  | { ok: false; degradation: DegradationEntry };

function readCached(htmlPath: string, etagPath: string): { html: string; etag?: string } | undefined {
  if (!existsSync(htmlPath)) return undefined;
  try {
    const html = readFileSync(htmlPath, 'utf-8');
    const etag = existsSync(etagPath) ? readFileSync(etagPath, 'utf-8').trim() : undefined;
    return { html, etag };
  } catch {
    return undefined;
  }
}

function writeCache(htmlPath: string, etagPath: string, html: string, etag: string | null): void {
  try {
    mkdirSync(htmlPath.replace(/\/[^/]+$/, ''), { recursive: true });
    writeFileSync(htmlPath, html, 'utf-8');
    if (etag) writeFileSync(etagPath, etag, 'utf-8');
  } catch { /* cache write failures are non-fatal */ }
}

export async function fetchHtml(url: string, cacheDir: string): Promise<FetchHtmlOutcome> {
  const htmlPath = `${cacheDir}/page.html`;
  const etagPath = `${htmlPath}.etag`;

  const cached = readCached(htmlPath, etagPath);
  const headers: Record<string, string> = { 'User-Agent': USER_AGENT };
  if (cached?.etag) headers['If-None-Match'] = cached.etag;

  try {
    const response = await fetch(url, { headers });

    if (response.status === 304 && cached) {
      return { ok: true, html: cached.html };
    }
    if (response.status === 403 || response.status === 429) {
      return { ok: false, degradation: { step: 'fetch', reason: 'blocked-on-fetch', detail: `HTTP ${response.status}` } };
    }
    if (!response.ok) {
      return { ok: false, degradation: { step: 'fetch', reason: 'source-unreachable', detail: `HTTP ${response.status}` } };
    }

    const html = await response.text();
    writeCache(htmlPath, etagPath, html, response.headers?.get('etag') ?? null);
    return { ok: true, html };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { ok: false, degradation: { step: 'fetch', reason: 'source-unreachable', detail } };
  }
}
