// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { VbrandSchema, type VbrandType } from '../../schema.js';
import { runPull } from '../../commands/pull.js';
import { runFuse } from '../../commands/fuse.js';
import { loadSchema } from '../../lib/schema-io.js';
import { sourceToSlug } from '../../lib/pull/slug.js';
import { loadFromFixtureHandle } from './fixture-loader.js';
import { resolveGitHubHomepage, resolveNpmHomepage } from './url-resolvers.js';
import type { BrandSourceAdapter } from './types.js';

export class DefaultBrandSourceAdapter implements BrandSourceAdapter {
  async loadFromUrl(url: string): Promise<VbrandType> {
    return withTmpDir(async (dir) => {
      await runPull(url, { candidateDir: dir, cwd: dir });
      const slug = sourceToSlug(url);
      const candidatePath = join(dir, `${slug}.candidate.json`);
      const schemaPath = join(dir, 'vbrand.schema.json');
      await runFuse([candidatePath], { schemaPath, cwd: dir, injectBaseline: true });
      return loadSchema(schemaPath);
    });
  }

  async loadFromGitHub(owner: string, repo: string): Promise<VbrandType> {
    const homepage = await resolveGitHubHomepage(owner, repo);
    return this.loadFromUrl(homepage);
  }

  async loadFromNpm(packageName: string): Promise<VbrandType> {
    const homepage = await resolveNpmHomepage(packageName);
    return this.loadFromUrl(homepage);
  }

  async loadFromLocalJson(path: string): Promise<VbrandType> {
    const raw: unknown = JSON.parse(readFileSync(path, 'utf8'));
    return VbrandSchema.parse(raw);
  }

  async loadFromCustomJson(payload: unknown): Promise<VbrandType> {
    return Promise.resolve(VbrandSchema.parse(payload));
  }

  async loadFromFixture(handle: string): Promise<VbrandType> {
    return loadFromFixtureHandle(handle);
  }
}

async function withTmpDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), 'vbrand-adapter-'));
  try {
    return await fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
