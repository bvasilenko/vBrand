// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  DEFAULT_STATE_DIR,
  appendHistory,
  readLastDeploy,
  readRollbackPointers,
  recordDeploy,
  writeRollbackPointers,
  findForbiddenPatterns,
} from '../../src/lib/deploy/state.js';

describe('deploy state', () => {
  let tmpDir: string;
  let stateDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'vbrand-deploy-state-'));
    stateDir = join(tmpDir, DEFAULT_STATE_DIR);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('appends history as JSON lines and reads back the last entry', async () => {
    await appendHistory(stateDir, {
      at: '2026-05-30T12:00:00Z',
      target: 'compose-ssh',
      imageRef: 'ghcr.io/booga/demo:v0.3.0',
      host: 'ssh://deploy@example.com',
      status: 'success',
    });
    await appendHistory(stateDir, {
      at: '2026-05-30T13:00:00Z',
      target: 'compose-ssh',
      imageRef: 'ghcr.io/booga/demo:v0.3.1',
      host: 'ssh://deploy@example.com',
      status: 'failed',
      reason: 'healthcheck timeout',
    });
    const last = await readLastDeploy(stateDir);
    expect(last?.imageRef).toBe('ghcr.io/booga/demo:v0.3.1');
    expect(last?.status).toBe('failed');
  });

  it('rollback pointers retain previous N deploys (cap at 5)', async () => {
    let pointers = { current: null as string | null, previous: [] as string[] };
    for (let i = 0; i < 7; i++) {
      pointers = recordDeploy(stateDir, `ghcr.io/demo:v${i}`, pointers);
    }
    expect(pointers.current).toBe('ghcr.io/demo:v6');
    expect(pointers.previous.length).toBeLessThanOrEqual(5);
    expect(pointers.previous[0]).toBe('ghcr.io/demo:v5');
  });

  it('writeRollbackPointers + readRollbackPointers round-trip', async () => {
    const original = { current: 'ghcr.io/demo:abc', previous: ['ghcr.io/demo:xyz'] };
    await writeRollbackPointers(stateDir, original);
    const read = await readRollbackPointers(stateDir);
    expect(read).toEqual(original);
  });

  it('findForbiddenPatterns flags Bearer tokens', () => {
    expect(findForbiddenPatterns('Bearer abc.def.ghi').length).toBeGreaterThan(0);
  });

  it('findForbiddenPatterns flags _TOKEN= shape', () => {
    expect(findForbiddenPatterns('SOMETHING_TOKEN=value').length).toBeGreaterThan(0);
  });

  it('findForbiddenPatterns flags OpenSSH private key header', () => {
    expect(findForbiddenPatterns('-----BEGIN OPENSSH PRIVATE KEY-----').length).toBeGreaterThan(0);
  });

  it('findForbiddenPatterns flags JWT shape', () => {
    expect(
      findForbiddenPatterns(
        'token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
      ).length,
    ).toBeGreaterThan(0);
  });

  it('findForbiddenPatterns is clean for env-var pointer values', () => {
    expect(findForbiddenPatterns('"auth":"COOLIFY_TOKEN"').length).toBe(0);
    expect(findForbiddenPatterns('SSH_AUTH_SOCK pointer only').length).toBe(0);
  });
});
