// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInitCi } from '../../src/commands/init-ci.js';

describe('init-ci', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'vbrand-init-ci-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('emits both forge workflows + Dockerfile + dockerignore + manifest + set-secrets', async () => {
    const result = await runInitCi({ forge: 'both', cwd: tmpDir });
    const paths = result.written.map((p) => p.replace(tmpDir + '/', ''));
    expect(paths).toContain('.github/workflows/vbrand-deploy.yml');
    expect(paths).toContain('.gitlab-ci.yml');
    expect(paths).toContain('Dockerfile');
    expect(paths).toContain('.dockerignore');
    expect(paths).toContain('vbrand.deploy.json');
    expect(paths).toContain('scripts/vbrand-set-secrets.sh');
  });

  it('emits only github workflow when --forge=github', async () => {
    const result = await runInitCi({ forge: 'github', cwd: tmpDir });
    const paths = result.written.map((p) => p.replace(tmpDir + '/', ''));
    expect(paths).toContain('.github/workflows/vbrand-deploy.yml');
    expect(paths).not.toContain('.gitlab-ci.yml');
  });

  it('manifest is single source of truth: workflows reference jq -r on it', async () => {
    await runInitCi({ forge: 'both', cwd: tmpDir });
    const gh = await readFile(join(tmpDir, '.github/workflows/vbrand-deploy.yml'), 'utf-8');
    const gl = await readFile(join(tmpDir, '.gitlab-ci.yml'), 'utf-8');
    expect(gh).toMatch(/jq -r \.registry\.kind vbrand\.deploy\.json/);
    expect(gh).toMatch(/jq -r \.build\.runtime vbrand\.deploy\.json/);
    expect(gl).toMatch(/jq -r \.deploy\.kind \$VBRAND_MANIFEST/);
  });

  it('emits set-secrets script as a stdin-piped read; vbrand process never reads', async () => {
    await runInitCi({ forge: 'both', deployKind: 'compose-ssh', cwd: tmpDir });
    const script = await readFile(join(tmpDir, 'scripts/vbrand-set-secrets.sh'), 'utf-8');
    expect(script).toMatch(/read -rs/);
    expect(script).toMatch(/gh secret set DEPLOY_SSH_KEY --body -/);
  });

  it('does not overwrite existing Dockerfile without --force', async () => {
    await writeFile(join(tmpDir, 'Dockerfile'), 'FROM custom\n', 'utf-8');
    const result = await runInitCi({ forge: 'both', cwd: tmpDir });
    const skipped = result.skipped.map((p) => p.replace(tmpDir + '/', ''));
    expect(skipped).toContain('Dockerfile');
    const existing = await readFile(join(tmpDir, 'Dockerfile'), 'utf-8');
    expect(existing).toBe('FROM custom\n');
  });

  it('produces a manifest that validates expected shape', async () => {
    await runInitCi({ forge: 'both', registry: 'ghcr', deployKind: 'compose-ssh', runtime: 'nginx', cwd: tmpDir });
    const raw = await readFile(join(tmpDir, 'vbrand.deploy.json'), 'utf-8');
    const manifest = JSON.parse(raw);
    expect(manifest.vbrandCi).toBe('0.3.0');
    expect(manifest.registry.kind).toBe('ghcr');
    expect(manifest.deploy.kind).toBe('compose-ssh');
    expect(manifest.build.runtime).toBe('nginx');
  });
});
