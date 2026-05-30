// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runDeploy } from '../../src/commands/deploy.js';

describe('deploy dry-run', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'vbrand-deploy-'));
    await writeFile(
      join(tmpDir, 'vbrand.deploy.json'),
      JSON.stringify({
        vbrandCi: '0.3.0',
        registry: { kind: 'ghcr', imageName: 'booga/demo', additionalTags: ['latest'] },
        deploy: {
          kind: 'compose-ssh',
          host: 'unix:///var/run/docker.sock',
          sshSecret: 'SSH_AUTH_SOCK',
        },
        build: { runtime: 'nginx', context: '.', platforms: ['linux/amd64'] },
      }),
      'utf-8',
    );
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('--dry-run returns ok with a plan, never runs docker', async () => {
    const result = await runDeploy({ dryRun: true, cwd: tmpDir });
    expect(result.ok).toBe(true);
    expect(result.imageRef).toContain('ghcr.io/booga/demo');
    expect(result.reason).toContain('dry-run');
    expect(result.liveUrl).toBe('http://localhost:8080');
  });

  it('target=none is a no-op exit ok', async () => {
    const result = await runDeploy({ target: 'none', cwd: tmpDir });
    expect(result.ok).toBe(true);
    expect(result.reason).toContain('no-op');
  });
});
