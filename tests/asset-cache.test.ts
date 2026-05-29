// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cacheAsset, isDataUri } from '../src/lib/pull/asset-cache.js';

const tmp = () => mkdtempSync(join(tmpdir(), 'vbrand-cache-'));

function mockFetch(responses: Array<{
  ok?: boolean;
  status?: number;
  statusText?: string;
  headers?: Record<string, string | null>;
  body?: Uint8Array;
}>): void {
  let index = 0;
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
    const r = responses[index] ?? responses[responses.length - 1]!;
    index++;
    const body = r.body ?? new Uint8Array([1, 2, 3, 4]);
    return {
      ok: r.ok ?? true,
      status: r.status ?? 200,
      statusText: r.statusText ?? 'OK',
      headers: { get: (key: string) => r.headers?.[key.toLowerCase()] ?? null },
      arrayBuffer: async () => body.buffer as ArrayBuffer,
    };
  }));
}

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs.length = 0;
  vi.restoreAllMocks();
});

describe('isDataUri', () => {
  it('returns true for data: URIs', () => {
    expect(isDataUri('data:image/png;base64,abc==')).toBe(true);
    expect(isDataUri('data:image/svg+xml,<svg/>')).toBe(true);
  });

  it('returns false for http/https URLs', () => {
    expect(isDataUri('https://example.com/icon.png')).toBe(false);
    expect(isDataUri('http://example.com/icon.ico')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isDataUri('')).toBe(false);
  });
});

describe('cacheAsset - happy path', () => {
  it('kind: hit when download succeeds', async () => {
    const dir = tmp(); dirs.push(dir);
    mockFetch([{ ok: true }]);
    const { result } = await cacheAsset('https://example.com/icon.png', dir, 'favicon');
    expect(result.kind).toBe('hit');
  });

  it('writes the binary content to the cache directory', async () => {
    const dir = tmp(); dirs.push(dir);
    mockFetch([{ ok: true, body: new Uint8Array([0xDE, 0xAD, 0xBE, 0xEF]) }]);
    const { result } = await cacheAsset('https://example.com/icon.png', dir, 'favicon');
    if (result.kind === 'hit') {
      const bytes = readFileSync(result.localPath);
      expect(bytes[0]).toBe(0xDE);
      expect(bytes[3]).toBe(0xEF);
    }
  });

  it('writes an ETag sidecar file when the response provides one', async () => {
    const dir = tmp(); dirs.push(dir);
    mockFetch([{ ok: true, headers: { etag: '"abc123"' } }]);
    const { result } = await cacheAsset('https://example.com/icon.png', dir, 'favicon');
    if (result.kind === 'hit') {
      const etagFile = `${result.localPath}.etag`;
      expect(existsSync(etagFile)).toBe(true);
      expect(readFileSync(etagFile, 'utf-8')).toBe('"abc123"');
    }
  });

  it('does not create an ETag file when response has none', async () => {
    const dir = tmp(); dirs.push(dir);
    mockFetch([{ ok: true, headers: {} }]);
    const { result } = await cacheAsset('https://example.com/icon.png', dir, 'favicon');
    if (result.kind === 'hit') {
      expect(existsSync(`${result.localPath}.etag`)).toBe(false);
    }
  });

  it('produces no degradation entry on success', async () => {
    const dir = tmp(); dirs.push(dir);
    mockFetch([{ ok: true }]);
    const { degradation } = await cacheAsset('https://example.com/icon.png', dir, 'favicon');
    expect(degradation).toBeUndefined();
  });
});

describe('cacheAsset - ETag cache reuse (304 Not Modified)', () => {
  it('returns kind: hit without re-downloading on 304', async () => {
    const dir = tmp(); dirs.push(dir);
    mockFetch([
      { ok: true, headers: { etag: '"v1"' } },
      { ok: false, status: 304 },
    ]);
    await cacheAsset('https://example.com/icon.png', dir, 'favicon');
    const { result } = await cacheAsset('https://example.com/icon.png', dir, 'favicon');
    expect(result.kind).toBe('hit');
  });

  it('sends If-None-Match header on second request when ETag was stored', async () => {
    const dir = tmp(); dirs.push(dir);
    let capturedHeaders: Record<string, string> = {};
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (_, opts: { headers: Record<string, string> }) => {
      capturedHeaders = opts.headers ?? {};
      return {
        ok: true,
        status: 200,
        headers: { get: (k: string) => k === 'etag' ? '"v2"' : null },
        arrayBuffer: async () => new ArrayBuffer(4),
      };
    }));
    await cacheAsset('https://example.com/icon.png', dir, 'favicon');
    await cacheAsset('https://example.com/icon.png', dir, 'favicon');
    expect(capturedHeaders['If-None-Match']).toBe('"v2"');
  });
});

describe('cacheAsset - HTTP error responses', () => {
  it('returns kind: miss with reason blocked on 403', async () => {
    const dir = tmp(); dirs.push(dir);
    mockFetch([{ ok: false, status: 403 }]);
    const { result } = await cacheAsset('https://blocked.example.com/icon.png', dir, 'favicon');
    expect(result.kind).toBe('miss');
    if (result.kind === 'miss') expect(result.reason).toBe('blocked');
  });

  it('returns kind: miss with reason blocked on 429', async () => {
    const dir = tmp(); dirs.push(dir);
    mockFetch([{ ok: false, status: 429 }]);
    const { result } = await cacheAsset('https://ratelimited.example.com/icon.png', dir, 'favicon');
    expect(result.kind).toBe('miss');
    if (result.kind === 'miss') expect(result.reason).toBe('blocked');
  });

  it('returns kind: miss with reason download-failed on 404', async () => {
    const dir = tmp(); dirs.push(dir);
    mockFetch([{ ok: false, status: 404 }]);
    const { result } = await cacheAsset('https://missing.example.com/icon.png', dir, 'favicon');
    expect(result.kind).toBe('miss');
    if (result.kind === 'miss') expect(result.reason).toBe('download-failed');
  });

  it('includes a degradation entry for blocked responses', async () => {
    const dir = tmp(); dirs.push(dir);
    mockFetch([{ ok: false, status: 403 }]);
    const { degradation } = await cacheAsset('https://blocked.example.com/icon.png', dir, 'favicon');
    expect(degradation).toBeDefined();
    expect(degradation?.reason).toBe('blocked-on-fetch');
  });

  it('includes a degradation entry for failed downloads', async () => {
    const dir = tmp(); dirs.push(dir);
    mockFetch([{ ok: false, status: 500 }]);
    const { degradation } = await cacheAsset('https://broken.example.com/icon.png', dir, 'favicon');
    expect(degradation).toBeDefined();
    expect(degradation?.reason).toBe('download-failed');
  });
});

describe('cacheAsset - network failure', () => {
  it('returns kind: miss with reason download-failed on ENOTFOUND', async () => {
    const dir = tmp(); dirs.push(dir);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ENOTFOUND')));
    const { result } = await cacheAsset('https://unreachable.example.com/icon.png', dir, 'favicon');
    expect(result.kind).toBe('miss');
    if (result.kind === 'miss') expect(result.reason).toBe('download-failed');
  });

  it('includes a degradation entry for network failure', async () => {
    const dir = tmp(); dirs.push(dir);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Connection refused')));
    const { degradation } = await cacheAsset('https://unreachable.example.com/icon.png', dir, 'favicon');
    expect(degradation).toBeDefined();
    expect(degradation?.reason).toBe('download-failed');
  });
});

describe('cacheAsset - oversize protection', () => {
  it('returns kind: miss with reason oversize when response exceeds 10 MB', async () => {
    const dir = tmp(); dirs.push(dir);
    const oversize = new Uint8Array(11 * 1024 * 1024);
    mockFetch([{ ok: true, body: oversize }]);
    const { result } = await cacheAsset('https://huge.example.com/icon.png', dir, 'favicon');
    expect(result.kind).toBe('miss');
    if (result.kind === 'miss') expect(result.reason).toBe('oversize');
  });

  it('does not write a file for oversize responses', async () => {
    const dir = tmp(); dirs.push(dir);
    const oversize = new Uint8Array(11 * 1024 * 1024);
    mockFetch([{ ok: true, body: oversize }]);
    await cacheAsset('https://huge.example.com/icon.png', dir, 'favicon');
    expect(existsSync(join(dir, 'icon.png'))).toBe(false);
  });
});

describe('cacheAsset - Content-Type to extension derivation', () => {
  it.each([
    ['image/x-icon',              'asset.ico'],
    ['image/vnd.microsoft.icon',  'asset.ico'],
    ['image/png',                 'asset.png'],
    ['image/jpeg',                'asset.jpg'],
    ['image/svg+xml',             'asset.svg'],
    ['image/webp',                'asset.webp'],
    ['image/gif',                 'asset.gif'],
  ])('Content-Type "%s" → extension produces file with correct ext', async (mimeType, _expected) => {
    const dir = tmp(); dirs.push(dir);
    mockFetch([{ ok: true, headers: { 'content-type': mimeType } }]);
    const { result } = await cacheAsset('https://example.com/asset', dir, 'favicon');
    expect(result.kind).toBe('hit');
    if (result.kind === 'hit') {
      const ext = mimeType.split('/')[1]!
        .replace('x-icon', 'ico')
        .replace('vnd.microsoft.icon', 'ico')
        .replace('svg+xml', 'svg')
        .replace('jpeg', 'jpg');
      expect(result.localPath).toContain(`.${ext}`);
    }
  });

  it('preserves existing extension from URL when present', async () => {
    const dir = tmp(); dirs.push(dir);
    mockFetch([{ ok: true, headers: { 'content-type': 'image/png' } }]);
    const { result } = await cacheAsset('https://example.com/icon.ico', dir, 'favicon');
    if (result.kind === 'hit') {
      expect(result.localPath).toContain('.ico');
    }
  });
});

describe('cacheAsset - data: URI materialization', () => {
  it('does not make a network request for data: URIs', async () => {
    const dir = tmp(); dirs.push(dir);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await cacheAsset('data:image/png;base64,iVBORw0KGgo=', dir, 'favicon');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns kind: hit for base64 data URI', async () => {
    const dir = tmp(); dirs.push(dir);
    const { result } = await cacheAsset('data:image/png;base64,iVBORw0KGgo=', dir, 'favicon');
    expect(result.kind).toBe('hit');
  });

  it('writes a local file for base64 data URI', async () => {
    const dir = tmp(); dirs.push(dir);
    const { result } = await cacheAsset('data:image/png;base64,iVBORw0KGgo=', dir, 'favicon');
    if (result.kind === 'hit') {
      expect(existsSync(result.localPath)).toBe(true);
    }
  });

  it('derives file extension from MIME type in data URI', async () => {
    const dir = tmp(); dirs.push(dir);
    const { result: png } = await cacheAsset('data:image/png;base64,abc=', dir, 'favicon');
    const { result: svg } = await cacheAsset('data:image/svg+xml,<svg/>', dir, 'logo');
    if (png.kind === 'hit') expect(png.localPath).toContain('.png');
    if (svg.kind === 'hit') expect(svg.localPath).toContain('.svg');
  });

  it('materializes plain-text data URI as UTF-8', async () => {
    const dir = tmp(); dirs.push(dir);
    const content = 'hello world';
    const encoded = Buffer.from(content).toString('base64');
    const { result } = await cacheAsset(`data:text/plain;base64,${encoded}`, dir, 'text');
    if (result.kind === 'hit') {
      const written = readFileSync(result.localPath);
      expect(written.toString()).toBe(content);
    }
  });

  it('produces a .bin file for unknown data URI MIME type', async () => {
    const dir = tmp(); dirs.push(dir);
    const { result } = await cacheAsset('data:application/unknown,rawdata', dir, 'mystery');
    if (result.kind === 'hit') {
      expect(result.localPath).toContain('.bin');
    }
  });
});

describe('cacheAsset - degradation entry step label', () => {
  it('step label includes the fieldLabel parameter', async () => {
    const dir = tmp(); dirs.push(dir);
    mockFetch([{ ok: false, status: 403 }]);
    const { degradation } = await cacheAsset('https://blocked.example.com/icon.png', dir, 'logo');
    expect(degradation?.step).toContain('logo');
  });
});
