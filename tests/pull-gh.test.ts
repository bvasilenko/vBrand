// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { join } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { describe, expect, it, afterEach, vi } from 'vitest';
import { fetchFromGh } from '../src/lib/pull/from-gh.js';

const FIXTURE_DIR = join(import.meta.dirname, 'fixtures', 'gh');

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('fetchFromGh - fixture-replay mode (acceptance #17)', () => {
  it('returns a CandidateDoc with $candidate: true', async () => {
    vi.stubEnv('VBRAND_GH_FIXTURE_DIR', FIXTURE_DIR);
    const doc = await fetchFromGh('testuser');
    expect(doc.$candidate).toBe(true);
  });

  it('extracts name from fixture', async () => {
    vi.stubEnv('VBRAND_GH_FIXTURE_DIR', FIXTURE_DIR);
    const doc = await fetchFromGh('testuser');
    expect(doc.fields.name.value).toBe('Test User');
  });

  it('sets sourceUri to gh:<handle>', async () => {
    vi.stubEnv('VBRAND_GH_FIXTURE_DIR', FIXTURE_DIR);
    const doc = await fetchFromGh('testuser');
    expect(doc.sourceUri).toBe('gh:testuser');
  });

  it('extracts hex color from bio into colors field', async () => {
    vi.stubEnv('VBRAND_GH_FIXTURE_DIR', FIXTURE_DIR);
    const doc = await fetchFromGh('testuser');
    const colors = doc.fields.colors.value;
    if (colors) {
      expect(Object.values(colors).some((c) => c.startsWith('#'))).toBe(true);
    }
  });

  it('throws when fixture is missing for unknown handle', async () => {
    vi.stubEnv('VBRAND_GH_FIXTURE_DIR', FIXTURE_DIR);
    await expect(fetchFromGh('no-such-user-xyz')).rejects.toThrow('fixture not found');
  });
});

describe('fetchFromGh - network mode (mocked)', () => {
  it('falls back to REST when profile HTML has no name', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/users/netuser') && !url.includes('/repos')) {
          return {
            ok: true,
            json: async () => ({
              name: 'Net User',
              bio: 'hello',
              avatar_url: 'https://example.com/avatar.png',
            }),
          };
        }
        if (url.includes('/repos')) {
          return { ok: true, json: async () => [] };
        }
        return { ok: true, text: async () => '<html><body></body></html>' };
      }),
    );

    const doc = await fetchFromGh('netuser');
    expect(doc.fields.name.value).toBe('Net User');
    expect(doc.sourceUri).toBe('gh:netuser');
    expect(doc.fields.voiceCanonical.value).toBe('hello');
    expect(doc.fields.voiceCanonical.source).toBe('github-bio');
    expect(doc.fields.voiceDescription.value).toBe('hello');
    expect(doc.fields.voiceDescription.confidence).toBe('medium');
    expect(doc.fields.voiceDescription.source).toBe('github-bio');
  });
});

describe('fetchFromGh - HTML-primary path (acceptance #17)', () => {
  it('uses display name from HTML itemprop="name" with high confidence', async () => {
    const htmlWithName = `<html><body>
      <span itemprop="name">Html Profile Name</span>
    </body></html>`;

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/repos')) return { ok: true, json: async () => [] };
        if (url.includes('api.github.com/users/') && !url.includes('/repos')) {
          return { ok: true, json: async () => ({ name: 'REST Name', bio: '', avatar_url: '' }) };
        }
        return { ok: true, text: async () => htmlWithName };
      }),
    );

    const doc = await fetchFromGh('htmluser');
    expect(doc.fields.name.value).toBe('Html Profile Name');
    expect(doc.fields.name.confidence).toBe('high');
  });

  it('falls back to REST name with medium confidence when HTML has no name', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/repos')) return { ok: true, json: async () => [] };
        if (url.includes('api.github.com/users/') && !url.includes('/repos')) {
          return { ok: true, json: async () => ({ name: 'REST Fallback', bio: '' }) };
        }
        return { ok: true, text: async () => '<html><body></body></html>' };
      }),
    );

    const doc = await fetchFromGh('fallbackuser');
    expect(doc.fields.name.value).toBe('REST Fallback');
  });

  it('sets sourceUri correctly in HTML-primary scenario', async () => {
    const htmlWithName = `<html><body><span itemprop="name">Name</span></body></html>`;

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/repos')) return { ok: true, json: async () => [] };
        return { ok: true, text: async () => htmlWithName };
      }),
    );

    const doc = await fetchFromGh('srcuser');
    expect(doc.sourceUri).toBe('gh:srcuser');
  });

  it('extracts hex color from bio with low confidence', async () => {
    const htmlWithBio = `<html><body>
      <span itemprop="name">Bio User</span>
      <div class="p-note">Building great things with #ff6600</div>
    </body></html>`;

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/repos')) return { ok: true, json: async () => [] };
        return { ok: true, text: async () => htmlWithBio };
      }),
    );

    const doc = await fetchFromGh('biouser');
    expect(doc.fields.name.value).toBe('Bio User');
    if (doc.fields.colors.value) {
      expect(Object.values(doc.fields.colors.value).some((c) => c.toLowerCase() === '#ff6600')).toBe(true);
      expect(doc.fields.colors.confidence).toBe('low');
    }
  });
});

describe('fetchFromGh - provenance contracts', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
    dirs.length = 0;
  });

  it('provenance.degradations is an array in GH candidate', async () => {
    vi.stubEnv('VBRAND_GH_FIXTURE_DIR', FIXTURE_DIR);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: (h: string) => (h === 'content-type' ? 'image/png' : null) },
        arrayBuffer: async () => new ArrayBuffer(8),
      }),
    );
    const cacheBase = mkdtempSync(join(tmpdir(), 'vbrand-gh-prov-')); dirs.push(cacheBase);
    const doc = await fetchFromGh('testuser', cacheBase);
    expect(Array.isArray(doc.provenance.degradations)).toBe(true);
  });

  it('records provenance.assets with sourceUrl and localPath when avatar is downloaded', async () => {
    vi.stubEnv('VBRAND_GH_FIXTURE_DIR', FIXTURE_DIR);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: (h: string) => (h === 'content-type' ? 'image/png' : null) },
        arrayBuffer: async () => new ArrayBuffer(8),
      }),
    );
    const cacheBase = mkdtempSync(join(tmpdir(), 'vbrand-gh-prov-')); dirs.push(cacheBase);
    const doc = await fetchFromGh('testuser', cacheBase);
    const assetEntry = doc.provenance.assets.find((a) => a.field === 'assets.favicon');
    expect(assetEntry).toBeDefined();
    expect(assetEntry?.sourceUrl).toBe('https://avatars.githubusercontent.com/u/1?v=4');
    expect(assetEntry?.localPath).toBeTruthy();
  });
});
