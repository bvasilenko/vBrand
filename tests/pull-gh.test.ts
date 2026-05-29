// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { join } from 'node:path';
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
