// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { DeployAdapter, PrepareInput } from './types.js';

function run(cmd: string, args: string[], env?: Record<string, string>): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      env: { ...process.env, ...(env ?? {}) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (b) => (stdout += b.toString()));
    child.stderr.on('data', (b) => (stderr += b.toString()));
    child.on('error', reject);
    child.on('close', (code) => resolve({ stdout, stderr, code }));
  });
}

function composeFile(imageRef: string, runtime: 'nginx' | 'bun'): string {
  const port = runtime === 'nginx' ? '8080:80' : '8080:3000';
  return `services:
  app:
    image: ${imageRef}
    container_name: vbrand-app
    restart: unless-stopped
    ports:
      - "${port}"
    healthcheck:
      test: ["CMD", "wget", "-q", "-O-", "http://localhost/"]
      interval: 10s
      timeout: 2s
      retries: 5
`;
}

export interface ComposeSshAdapterOptions {
  stateDir: string;
  runtime: 'nginx' | 'bun';
}

export function createComposeSshAdapter(opts: ComposeSshAdapterOptions): DeployAdapter {
  return {
    name: 'compose-ssh',

    async prepare(input: PrepareInput) {
      const contextName = `vbrand-${Buffer.from(input.host).toString('base64url').slice(0, 16)}`;
      const composePath = join(opts.stateDir, 'targets', 'compose-ssh', 'docker-compose.rendered.yml');
      await mkdir(dirname(composePath), { recursive: true });
      await writeFile(composePath, composeFile(input.imageRef, opts.runtime), 'utf-8');

      // Create or update Docker context. Skip if host is the default unix socket.
      if (!input.host.startsWith('unix://')) {
        // best-effort remove + create (rm errors are ignored)
        await run('docker', ['context', 'rm', '-f', contextName]).catch(() => undefined);
        const result = await run('docker', [
          'context',
          'create',
          contextName,
          '--docker',
          `host=${input.host}`,
        ]);
        if (result.code !== 0 && !result.stderr.includes('already exists')) {
          throw new Error(`docker context create failed: ${result.stderr || result.stdout}`);
        }
      }

      return { contextName, composePath };
    },

    async trigger({ contextName, composePath, imageRef }) {
      if (!composePath) throw new Error('compose-ssh adapter requires composePath');
      const ctxArgs = contextName.startsWith('vbrand-') && !contextName.includes('local')
        ? ['--context', contextName]
        : [];
      const pull = await run('docker', [...ctxArgs, 'compose', '-f', composePath, 'pull']);
      if (pull.code !== 0) {
        throw new Error(`compose pull failed: ${pull.stderr || pull.stdout}`);
      }
      const up = await run('docker', [...ctxArgs, 'compose', '-f', composePath, 'up', '-d', '--remove-orphans']);
      if (up.code !== 0) {
        throw new Error(`compose up failed: ${up.stderr || up.stdout}`);
      }
      return { digest: imageRef };
    },

    async health({ contextName, composePath, timeoutMs }) {
      if (!composePath) return { ok: false, details: 'no composePath' };
      const ctxArgs = contextName.startsWith('vbrand-') && !contextName.includes('local')
        ? ['--context', contextName]
        : [];
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const ps = await run('docker', [...ctxArgs, 'compose', '-f', composePath, 'ps', '--format', 'json']);
        if (ps.code === 0 && ps.stdout.includes('"State":"running"')) {
          return { ok: true };
        }
        await new Promise((r) => setTimeout(r, 1000));
      }
      return { ok: false, details: 'healthcheck timeout' };
    },

    async rollback({ contextName, composePath, toImageRef }) {
      if (!composePath) throw new Error('compose-ssh rollback requires composePath');
      // re-render the compose file at the previous image ref and re-up.
      await writeFile(composePath, composeFile(toImageRef, opts.runtime), 'utf-8');
      const ctxArgs = contextName.startsWith('vbrand-') && !contextName.includes('local')
        ? ['--context', contextName]
        : [];
      const up = await run('docker', [...ctxArgs, 'compose', '-f', composePath, 'up', '-d']);
      if (up.code !== 0) {
        throw new Error(`rollback compose up failed: ${up.stderr || up.stdout}`);
      }
    },
  };
}
