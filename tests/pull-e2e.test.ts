// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterAll, describe, expect, it, vi, afterEach } from 'vitest';
import sharp from 'sharp';
import { fetchFromUrl } from '../src/lib/pull/from-url.js';
import { loadFromLocal } from '../src/lib/pull/from-local.js';
import { runFuse } from '../src/commands/fuse.js';
import { runEmit } from '../src/commands/emit.js';
import { runAudit } from '../src/commands/audit.js';
import { writeCandidateDoc } from '../src/lib/schema-io.js';

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});
afterEach(() => { vi.restoreAllMocks(); });

const RICH_FIXTURE_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta property="og:site_name" content="E2E Brand" />
  <meta property="og:title" content="E2E Brand | The complete pipeline" />
  <meta property="og:description" content="End-to-end fixture for the pull-fuse-emit-audit chain." />
  <meta name="theme-color" content="#6366f1" />
  <link rel="icon" href="/favicon.ico" />
</head>
<body><h1>E2E Brand</h1></body>
</html>`;

const BASE_FIXTURE = {
  name: 'e2e-base',
  voice: { canonical: 'Base canonical voice.', repoDescription: 'Base repo description.' },
  assets: {
    favicon: { source: 'logo.png', sizes: [16, 32] },
    og: { dimensions: [1200, 630] as [number, number] },
    icons: { source: 'icons/', set: [] as string[] },
  },
  tokens: { color: { primary: '#0f172a' }, type: {} as Record<string, string> },
};

async function buildWorkspace(): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), 'vbrand-e2e-'));
  dirs.push(dir);

  await sharp({
    create: { width: 64, height: 64, channels: 4, background: { r: 99, g: 102, b: 241, alpha: 255 } },
  }).png().toFile(join(dir, 'logo.png'));

  mkdirSync(join(dir, 'icons'), { recursive: true });

  return dir;
}

function mockFetchHappy(_cacheDir: string) {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
    if (typeof url === 'string' && url.endsWith('/favicon.ico')) {
      return {
        ok: true, status: 200,
        text: async () => '',
        arrayBuffer: async () => new ArrayBuffer(16),
        headers: { get: (h: string) => (h === 'content-type' ? 'image/x-icon' : null) },
      };
    }
    return {
      ok: true, status: 200,
      text: async () => RICH_FIXTURE_HTML,
      arrayBuffer: async () => new ArrayBuffer(0),
      headers: { get: () => null },
    };
  }));
}

function writeBaseFixture(workspace: string, filename: string): string {
  const jsonPath = join(workspace, `${filename}.json`);
  writeFileSync(jsonPath, JSON.stringify(BASE_FIXTURE, null, 2), 'utf-8');
  const candidate = loadFromLocal(jsonPath);
  const candidatePath = join(workspace, `${filename}.candidate.json`);
  writeCandidateDoc(candidate, candidatePath);
  return candidatePath;
}

describe('pull → fuse → emit → audit pipeline', () => {
  it('runs to completion from a fresh workspace with exit-0 at every step', async () => {
    const workspace = await buildWorkspace();
    const cacheBase = join(workspace, 'vbrand', '.cache');
    mkdirSync(cacheBase, { recursive: true });

    mockFetchHappy(cacheBase);

    const webCandidate = await fetchFromUrl('https://e2e.example.com', cacheBase);
    expect(webCandidate.$candidate).toBe(true);

    const webCandidatePath = join(workspace, 'e2e-example-com.candidate.json');
    writeCandidateDoc(webCandidate, webCandidatePath);

    const baseCandidatePath = writeBaseFixture(workspace, 'base');

    const fuseResult = await runFuse([baseCandidatePath, webCandidatePath], {
      cwd: workspace,
      strategy: 'umbrella-wins',
    });
    expect(fuseResult.schema.name).toBeDefined();
    expect(existsSync(fuseResult.schemaPath)).toBe(true);

    const emitResult = await runEmit({ cwd: workspace });
    expect(emitResult.outDir).toContain('public');
    expect(existsSync(join(workspace, 'public', 'brand', 'og.png'))).toBe(true);
    expect(existsSync(join(workspace, 'public', 'brand', 'manifest.webmanifest'))).toBe(true);
    expect(existsSync(join(workspace, 'public', 'brand', 'brand-tokens.css'))).toBe(true);
    expect(existsSync(join(workspace, 'public', 'brand', 'DESIGN.md'))).toBe(true);
    const faviconFiles = emitResult.files.filter((f) => f.includes('favicon'));
    expect(faviconFiles.length).toBeGreaterThan(0);

    const auditResult = await runAudit({ cwd: workspace });
    expect(auditResult.clean).toBe(true);
    expect(auditResult.drifted).toHaveLength(0);
  }, 30_000);

  it('chain continues and fuse succeeds when the web fetch is blocked (HTTP 403)', async () => {
    const workspace = await buildWorkspace();
    const cacheBase = join(workspace, 'vbrand', '.cache');
    mkdirSync(cacheBase, { recursive: true });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 403,
      text: async () => '',
      arrayBuffer: async () => new ArrayBuffer(0),
      headers: { get: () => null },
    }));

    const blockedCandidate = await fetchFromUrl('https://blocked.example.com', cacheBase);
    expect(blockedCandidate.$candidate).toBe(true);
    expect(
      blockedCandidate.provenance.degradations.some((d) => d.reason === 'blocked-on-fetch'),
    ).toBe(true);
    expect(blockedCandidate.fields.voiceCanonical.confidence).toBe('none');
    expect(blockedCandidate.fields.colors.confidence).toBe('none');

    const blockedPath = join(workspace, 'blocked.candidate.json');
    writeCandidateDoc(blockedCandidate, blockedPath);

    const baseCandidatePath = writeBaseFixture(workspace, 'base2');

    const fuseResult = await runFuse([baseCandidatePath, blockedPath], {
      cwd: workspace,
      strategy: 'umbrella-wins',
    });
    expect(fuseResult.schema.name).toBeDefined();
    expect(existsSync(fuseResult.schemaPath)).toBe(true);
  }, 30_000);
});
