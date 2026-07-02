// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import type { Stats } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import type { DeploymentTargetAdapter } from './contract.js';
import type { DeployTargetName } from './types.js';
import { buildStaticDeployBundle } from './bundle.js';
import { createGhPagesTarget, DECOUPLED_FOR_LATER_MESSAGE, DEFAULT_DEPLOY_TARGET, DEPLOY_TARGET_NAMES, DEPLOY_TARGET_REGISTRY, getDeployTarget, parseDeployTarget } from './index.js';
import { DEPLOY_TARGET_METADATA, getDeployTargetMetadata } from './metadata.js';

const composition = { sections: [{ id: 'hero', visible: true, density: 'regular' as const, order: 0 }] };
const content = { 'landing.hero.heading': 'Deploy preview' };
const hostedResult = {
  url: 'https://bvasilenko.github.io/vBrand/',
  logs: ['mock gh-pages'],
  status: 'ok' as const,
  durationMs: 1,
};


async function demoDistFixture(files: Record<string, string> = {}): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vbrand-demo-dist-'));
  const entries = {
    'index.html': '<!doctype html><html><body><main>fixture</main><script type="module" src="/assets/index.js"></script></body></html>',
    'assets/index.js': 'window.__fixture = true;',
    ...files,
  };
  for (const [name, contents] of Object.entries(entries)) {
    const target = path.join(dir, name);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, contents);
  }
  return dir;
}

async function fixtureTarget() {
  const distDir = await demoDistFixture();
  return createGhPagesTarget(async () => hostedResult, (_composition, tree) => buildStaticDeployBundle({ distDir, content: tree }));
}

function expectRequiredStaticBundleShape(paths: readonly string[]) {
  expect(paths).toContain('index.html');
  expect(paths).toContain('404.html');
  expect(paths.some((file) => file.startsWith('assets/'))).toBe(true);
  expect(paths.some((file) => file.startsWith('data/'))).toBe(true);
}

describe('DeploymentTargetAdapter contract', () => {
  it('keeps every registry member type-compatible and name-aligned', () => {
    expect(Object.keys(DEPLOY_TARGET_REGISTRY).sort()).toEqual([...DEPLOY_TARGET_NAMES].sort());
    for (const [name, adapter] of Object.entries(DEPLOY_TARGET_REGISTRY)) {
      expectTypeOf(adapter).toMatchTypeOf<DeploymentTargetAdapter>();
      expect(adapter.name()).toBe(name);
    }
  });

  it('parses invalid deploy target input to the documented default', () => {
    expect(parseDeployTarget(null)).toBe(DEFAULT_DEPLOY_TARGET);
    expect(parseDeployTarget(undefined)).toBe(DEFAULT_DEPLOY_TARGET);
    expect(parseDeployTarget('render')).toBe(DEFAULT_DEPLOY_TARGET);
    for (const name of DEPLOY_TARGET_NAMES) expect(parseDeployTarget(name)).toBe(name);
  });

  it('emits a gh-pages static bundle with required files and hashes', async () => {
    const adapter = await fixtureTarget();
    const bundle = await adapter.emitArtifact(composition, content);
    const paths = bundle.files.map((file) => file.path);
    expect(bundle.manifest.primaryEntry).toBe('index.html');
    expectRequiredStaticBundleShape(paths);
    expect(Object.keys(bundle.manifest.assetHashes).sort()).toEqual([...paths].sort());
    for (const digest of Object.values(bundle.manifest.assetHashes)) expect(digest).toMatch(/^[a-f0-9]{64}$/);
  });



  it('normalizes optional static deploy files without replacing existing artefacts', async () => {
    const distDir = await demoDistFixture({
      '404.html': '<!doctype html><html><body>custom fallback</body></html>',
      'data/existing.json': '{"stable":true}',
      'assets/extra.css': 'body { color: black; }',
    });
    const bundle = await buildStaticDeployBundle({ distDir, content });
    const files = new Map(bundle.files.map((file) => [file.path, String(file.contents)]));
    expect([...files.keys()]).toEqual([...files.keys()].sort());
    expect(files.get('404.html')).toContain('custom fallback');
    expect(files.get('data/existing.json')).toBe('{"stable":true}');
    expect(files.has('data/content.json')).toBe(false);
    expect(bundle.manifest.assetHashes['404.html']).toMatch(/^[a-f0-9]{64}$/);
  });

  it.each([
    ['missing index', {}, 'MISSING_DEPLOY_ARTEFACT'],
    ['missing assets', { 'index.html': '<!doctype html><html></html>' }, 'MISSING_DEPLOY_ARTEFACT: assets/'],
  ])('fails fast for invalid static deploy dist: %s', async (_case, files, message) => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vbrand-invalid-dist-'));
    for (const [name, contents] of Object.entries(files)) {
      const target = path.join(dir, name);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, contents);
    }
    await expect(buildStaticDeployBundle({ distDir: dir, content })).rejects.toThrow(message);
  });

  it('fails deferred deployment slots loudly', async () => {
    const adapter = await fixtureTarget();
    const bundle = await adapter.emitArtifact(composition, content);
    for (const [name, adapter] of Object.entries(DEPLOY_TARGET_REGISTRY)) {
      if (name === 'gh-pages') continue;
      await expect(adapter.deployBundle(bundle)).rejects.toThrow(DECOUPLED_FOR_LATER_MESSAGE);
    }
  });

  it('deploys gh-pages bundles through an isolated shell boundary', async () => {
    const calls: string[] = [];
    const adapter = createGhPagesTarget(async (dir) => {
      calls.push(dir);
      return hostedResult;
    }, async (_composition, tree) => buildStaticDeployBundle({ distDir: await demoDistFixture(), content: tree }));
    const result = await adapter.deployBundle(await adapter.emitArtifact(composition, content));
    expect(result.status).toBe('ok');
    expect(result.logs).toEqual(['mock gh-pages']);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain('vbrand-gh-pages-');
  });
});

describe('DeploymentTargetAdapter registry and bundle structural contract', () => {
  it('DEPLOY_TARGET_NAMES contains exactly 7 platforms covering all documented deploy targets', () => {
    expect(DEPLOY_TARGET_NAMES).toHaveLength(7);
    expect([...DEPLOY_TARGET_NAMES].sort()).toEqual([
      'cloudflare-pages', 'coolify', 'custom-vps', 'fly', 'gh-pages', 'netlify', 'vercel',
    ]);
  });

  it('getDeployTarget returns the named adapter for every valid target name', () => {
    for (const name of DEPLOY_TARGET_NAMES) expect(getDeployTarget(name).name()).toBe(name);
  });

  it('DEFAULT_DEPLOY_TARGET is gh-pages', () => {
    expect(DEFAULT_DEPLOY_TARGET).toBe('gh-pages');
  });

  it('bundle files are sorted lexicographically by path so consumers can binary-search or diff', async () => {
    const adapter = await fixtureTarget();
    const bundle = await adapter.emitArtifact(composition, content);
    const paths = bundle.files.map((file) => file.path);
    expect(paths).toEqual([...paths].sort());
  });

  it('bundle files contain no duplicate paths', async () => {
    const adapter = await fixtureTarget();
    const bundle = await adapter.emitArtifact(composition, content);
    const paths = bundle.files.map((file) => file.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('assetHashes keys and bundle file paths are identical sets in both directions', async () => {
    const adapter = await fixtureTarget();
    const bundle = await adapter.emitArtifact(composition, content);
    const filePaths = new Set(bundle.files.map((file) => file.path));
    const hashKeys = new Set(Object.keys(bundle.manifest.assetHashes));
    for (const key of hashKeys) expect(filePaths.has(key)).toBe(true);
    for (const p of filePaths) expect(hashKeys.has(p)).toBe(true);
  });

  it('all asset hashes are 64-character hex strings regardless of file type or encoding', async () => {
    const adapter = await fixtureTarget();
    const bundle = await adapter.emitArtifact(composition, content);
    for (const hash of Object.values(bundle.manifest.assetHashes)) {
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it('DECOUPLED_FOR_LATER_MESSAGE names the bridge-cycle version that will unlock deferred targets', () => {
    expect(DECOUPLED_FOR_LATER_MESSAGE).toContain('DECOUPLED-FOR-LATER');
    expect(DECOUPLED_FOR_LATER_MESSAGE).toContain('0.5.0');
  });
});

describe('DeploymentTargetMetadata browser-safe contract', () => {
  it('metadata covers every deploy target exactly once', () => {
    const metadataNames = DEPLOY_TARGET_METADATA.map((target) => target.name);
    expect(metadataNames.sort()).toEqual([...DEPLOY_TARGET_NAMES].sort());
    expect(new Set(metadataNames).size).toBe(DEPLOY_TARGET_METADATA.length);
  });

  it('marks only the default deploy target as wired', () => {
    const wired = DEPLOY_TARGET_METADATA.filter((target) => target.status === 'wired');
    expect(wired).toHaveLength(1);
    expect(wired[0]?.name).toBe(DEFAULT_DEPLOY_TARGET);
    expect(wired[0]?.badge).toBe('index.html');
  });

  it('marks every non-default deploy target as decoupled for later', () => {
    for (const target of DEPLOY_TARGET_METADATA) {
      if (target.name === DEFAULT_DEPLOY_TARGET) continue;
      expect(target.status).toBe('decoupled-for-later');
      expect(target.badge).toBe('DECOUPLED-FOR-LATER');
    }
  });

  it('looks up metadata by target name and falls back to the default target for impossible input', () => {
    for (const target of DEPLOY_TARGET_METADATA) expect(getDeployTargetMetadata(target.name)).toEqual(target);
    expect(getDeployTargetMetadata('render' as DeployTargetName)).toEqual(getDeployTargetMetadata(DEFAULT_DEPLOY_TARGET));
  });
});

describe('DEFERRED_BUNDLE shape - non-gh-pages emitArtifact', () => {
  const DEFERRED_TARGET_NAMES = [...DEPLOY_TARGET_NAMES].filter((n) => n !== 'gh-pages');

  it.each(DEFERRED_TARGET_NAMES)(
    'emitArtifact for "%s" resolves without filesystem I/O (completes in < 50 ms)',
    async (name) => {
      const adapter = DEPLOY_TARGET_REGISTRY[name];
      const start = performance.now();
      await adapter.emitArtifact(composition, content);
      expect(performance.now() - start).toBeLessThan(50);
    },
  );

  it.each(DEFERRED_TARGET_NAMES)(
    'emitArtifact for "%s" returns a bundle containing index.html',
    async (name) => {
      const bundle = await DEPLOY_TARGET_REGISTRY[name].emitArtifact(composition, content);
      expect(bundle.files.map((f) => f.path)).toContain('index.html');
    },
  );

  it.each(DEFERRED_TARGET_NAMES)(
    'emitArtifact for "%s" returns a bundle containing 404.html',
    async (name) => {
      const bundle = await DEPLOY_TARGET_REGISTRY[name].emitArtifact(composition, content);
      expect(bundle.files.map((f) => f.path)).toContain('404.html');
    },
  );

  it.each(DEFERRED_TARGET_NAMES)(
    'emitArtifact for "%s" returns a bundle with at least one assets/ entry and one data/ entry',
    async (name) => {
      const bundle = await DEPLOY_TARGET_REGISTRY[name].emitArtifact(composition, content);
      const paths = bundle.files.map((f) => f.path);
      expect(paths.some((p) => p.startsWith('assets/'))).toBe(true);
      expect(paths.some((p) => p.startsWith('data/'))).toBe(true);
    },
  );

  it.each(DEFERRED_TARGET_NAMES)(
    'emitArtifact for "%s" has manifest.primaryEntry === "index.html"',
    async (name) => {
      const bundle = await DEPLOY_TARGET_REGISTRY[name].emitArtifact(composition, content);
      expect(bundle.manifest.primaryEntry).toBe('index.html');
    },
  );

  it.each(DEFERRED_TARGET_NAMES)(
    'deferred bundle for "%s" embeds DECOUPLED_FOR_LATER_MESSAGE in the index.html placeholder',
    async (name) => {
      const bundle = await DEPLOY_TARGET_REGISTRY[name].emitArtifact(composition, content);
      const indexFile = bundle.files.find((f) => f.path === 'index.html');
      expect(String(indexFile?.contents)).toContain(DECOUPLED_FOR_LATER_MESSAGE);
    },
  );

  it.each(DEFERRED_TARGET_NAMES)(
    'deferred bundle for "%s" embeds DECOUPLED_FOR_LATER_MESSAGE in the 404.html placeholder',
    async (name) => {
      const bundle = await DEPLOY_TARGET_REGISTRY[name].emitArtifact(composition, content);
      const notFoundFile = bundle.files.find((f) => f.path === '404.html');
      expect(String(notFoundFile?.contents)).toContain(DECOUPLED_FOR_LATER_MESSAGE);
    },
  );

  it('all deferred targets return the identical frozen bundle object (single shared constant)', async () => {
    const bundles = await Promise.all(
      DEFERRED_TARGET_NAMES.map((name) => DEPLOY_TARGET_REGISTRY[name].emitArtifact(composition, content)),
    );
    for (let i = 1; i < bundles.length; i++) {
      expect(bundles[i]).toBe(bundles[0]);
    }
  });
});

describe('parseDeployTarget - non-string and boundary inputs', () => {
  it('empty string falls back to DEFAULT_DEPLOY_TARGET', () => {
    expect(parseDeployTarget('')).toBe(DEFAULT_DEPLOY_TARGET);
  });

  it('numeric input falls back to DEFAULT_DEPLOY_TARGET', () => {
    expect(parseDeployTarget(0 as unknown as string)).toBe(DEFAULT_DEPLOY_TARGET);
    expect(parseDeployTarget(1 as unknown as string)).toBe(DEFAULT_DEPLOY_TARGET);
  });

  it('boolean input falls back to DEFAULT_DEPLOY_TARGET', () => {
    expect(parseDeployTarget(true as unknown as string)).toBe(DEFAULT_DEPLOY_TARGET);
    expect(parseDeployTarget(false as unknown as string)).toBe(DEFAULT_DEPLOY_TARGET);
  });

  it('object input falls back to DEFAULT_DEPLOY_TARGET', () => {
    expect(parseDeployTarget({} as unknown as string)).toBe(DEFAULT_DEPLOY_TARGET);
  });
});

const STAT_ERRORS_THAT_PROPAGATE = [
  { code: 'EACCES',  label: 'permission denied'                             },
  { code: 'EPERM',   label: 'operation not permitted'                       },
  { code: 'EIO',     label: 'I/O error'                                     },
  { code: 'ENOTDIR', label: 'intermediate path segment is not a directory'  },
] as const;

const STAT_ERRORS_THAT_NORMALIZE = [
  { code: 'ENOENT', label: 'file does not exist', tag: 'MISSING_DEPLOY_ARTEFACT' },
] as const;

const NON_FILE_NODE_TYPES: ReadonlyArray<{
  readonly nodeType: 'directory' | 'other';
  readonly isDirectory: () => boolean;
  readonly label: string;
}> = [
  { nodeType: 'directory', isDirectory: () => true,  label: 'directory'                                           },
  { nodeType: 'other',     isDirectory: () => false, label: 'non-file non-directory node (socket, FIFO, device)'  },
];

function fakeNonFileStat(isDirectory: () => boolean): Stats {
  return { isFile: () => false, isDirectory } as unknown as Stats;
}

describe('buildStaticDeployBundle - assertFile error taxonomy', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it.each(STAT_ERRORS_THAT_PROPAGATE)(
    'propagates $code ($label) stat error without normalizing to MISSING_DEPLOY_ARTEFACT',
    async ({ code }) => {
      const originalError = Object.assign(new Error(`${code}: operation failed`), { code });
      vi.spyOn(fs, 'stat').mockRejectedValueOnce(originalError);
      await expect(buildStaticDeployBundle({ distDir: '/any', content: {} })).rejects.toBe(originalError);
    },
  );

  it('propagates non-Error rejection from stat without normalizing', async () => {
    const nonErrorRejection = 'unexpected string rejection from fs.stat';
    vi.spyOn(fs, 'stat').mockRejectedValueOnce(nonErrorRejection as unknown as Error);
    await expect(buildStaticDeployBundle({ distDir: '/any', content: {} })).rejects.toBe(nonErrorRejection);
  });

  it.each(STAT_ERRORS_THAT_NORMALIZE)(
    'normalizes $code ($label) to a new $tag error embedding the checked path',
    async ({ code, tag }) => {
      const distDir = '/sentinel';
      const originalError = Object.assign(new Error(`${code}: operation failed`), { code });
      vi.spyOn(fs, 'stat').mockRejectedValueOnce(originalError);
      const thrown = await buildStaticDeployBundle({ distDir, content: {} }).catch((e: unknown) => e);
      expect(thrown).toBeInstanceOf(Error);
      expect(thrown).not.toBe(originalError);
      expect((thrown as Error).message).toContain(tag);
      expect((thrown as Error).message).toContain('index.html');
    },
  );

  it.each(NON_FILE_NODE_TYPES)(
    'maps $label at the checked path to DEPLOY_PATH_NOT_A_FILE: $nodeType embedding the path',
    async ({ nodeType, isDirectory }) => {
      const distDir = '/sentinel';
      vi.spyOn(fs, 'stat').mockResolvedValueOnce(fakeNonFileStat(isDirectory));
      const thrown = await buildStaticDeployBundle({ distDir, content: {} }).catch((e: unknown) => e);
      expect(thrown).toBeInstanceOf(Error);
      expect((thrown as Error).message).toContain(`DEPLOY_PATH_NOT_A_FILE: ${nodeType}`);
      expect((thrown as Error).message).toContain('index.html');
    },
  );
});
