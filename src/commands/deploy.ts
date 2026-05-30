// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { join } from 'node:path';
import { readdir, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { createComposeSshAdapter } from '../lib/deploy/compose-ssh.js';
import {
  DEFAULT_STATE_DIR,
  appendHistory,
  readLastDeploy,
  readManifest,
  readRollbackPointers,
  recordDeploy,
  writeRollbackPointers,
  findForbiddenPatterns,
} from '../lib/deploy/state.js';
import type { DeployAdapter, DeployTarget } from '../lib/deploy/types.js';

function resolveImageRef(provided: string | undefined, registry: string, imageName: string): string {
  if (provided) return provided;
  const host =
    registry === 'ghcr'
      ? 'ghcr.io'
      : registry === 'gitlab'
        ? 'registry.gitlab.com'
        : 'docker.io';
  return `${host}/${imageName}:latest`;
}

interface RunDeployInput {
  target?: DeployTarget;
  host?: string;
  authEnv?: string;
  imageRef?: string;
  rollbackOnFail?: boolean;
  dryRun?: boolean;
  cwd?: string;
}

interface RunDeployResult {
  ok: boolean;
  imageRef: string;
  contextName: string;
  liveUrl?: string;
  reason?: string;
}

export async function runDeploy(input: RunDeployInput = {}): Promise<RunDeployResult> {
  const cwd = input.cwd ?? process.cwd();
  const manifest = await readManifest(cwd);
  const target: DeployTarget = input.target ?? manifest.deploy.kind;
  const host = input.host ?? manifest.deploy.host ?? 'unix:///var/run/docker.sock';
  const imageRef = resolveImageRef(input.imageRef, manifest.registry.kind, manifest.registry.imageName);
  const stateDir = join(cwd, DEFAULT_STATE_DIR);

  if (target === 'none') {
    return {
      ok: true,
      imageRef,
      contextName: 'noop',
      reason: 'deploy.kind=none - no-op',
    };
  }

  let adapter: DeployAdapter;
  if (target === 'compose-ssh') {
    adapter = createComposeSshAdapter({ stateDir, runtime: manifest.build.runtime });
  } else {
    throw new Error(`deploy target '${target}' not implemented in 0.3.0; only 'compose-ssh' and 'none' supported`);
  }

  const authEnvVar = input.authEnv ?? manifest.deploy.sshSecret ?? 'SSH_AUTH_SOCK';
  // We do NOT pass the secret value into the adapter - only the env var name.
  const prepared = await adapter.prepare({ imageRef, host, authEnvVar });

  if (input.dryRun) {
    return {
      ok: true,
      imageRef,
      contextName: prepared.contextName,
      reason: 'dry-run - no deploy executed',
      liveUrl: 'http://localhost:8080',
    };
  }

  const startedEntry = {
    at: new Date().toISOString(),
    target,
    imageRef,
    host,
    status: 'started' as const,
  };
  await appendHistory(stateDir, startedEntry);

  try {
    await adapter.trigger({ imageRef, contextName: prepared.contextName, composePath: prepared.composePath });
    const health = await adapter.health({
      contextName: prepared.contextName,
      composePath: prepared.composePath,
      timeoutMs: 30_000,
    });

    if (!health.ok) {
      if (input.rollbackOnFail !== false) {
        const pointers = await readRollbackPointers(stateDir);
        if (pointers.current && pointers.previous.length > 0) {
          await adapter.rollback({
            toImageRef: pointers.previous[0],
            contextName: prepared.contextName,
            composePath: prepared.composePath,
          });
        }
      }
      await appendHistory(stateDir, {
        ...startedEntry,
        at: new Date().toISOString(),
        status: 'failed',
        reason: health.details,
      });
      return {
        ok: false,
        imageRef,
        contextName: prepared.contextName,
        reason: health.details ?? 'healthcheck failed',
      };
    }

    const pointers = await readRollbackPointers(stateDir);
    await writeRollbackPointers(stateDir, recordDeploy(stateDir, imageRef, pointers));
    await appendHistory(stateDir, {
      ...startedEntry,
      at: new Date().toISOString(),
      status: 'success',
    });

    return {
      ok: true,
      imageRef,
      contextName: prepared.contextName,
      liveUrl: host.startsWith('unix://') || host.includes('localhost')
        ? 'http://localhost:8080'
        : `http://${host.replace(/^ssh:\/\/[^@]+@/, '').replace(/:.*$/, '')}:8080`,
    };
  } catch (err) {
    await appendHistory(stateDir, {
      ...startedEntry,
      at: new Date().toISOString(),
      status: 'failed',
      reason: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

export async function runDoctor(opts: { cwd?: string } = {}): Promise<{ ok: boolean; findings: string[] }> {
  const findings: string[] = [];
  const cwd = opts.cwd ?? process.cwd();
  // Check manifest exists
  try {
    await readManifest(cwd);
  } catch {
    findings.push("missing vbrand.deploy.json (run 'vbrand init-ci' first)");
  }

  // Check docker binary available
  const dockerCheck = await new Promise<boolean>((resolve) => {
    const child = spawn('docker', ['--version'], { stdio: 'ignore' });
    child.on('error', () => resolve(false));
    child.on('close', (code) => resolve(code === 0));
  });
  if (!dockerCheck) findings.push('docker CLI not found on PATH');

  // Scan vbrand/.deploy/ for forbidden secret patterns
  const stateDir = join(cwd, DEFAULT_STATE_DIR);
  try {
    const entries = await readdir(stateDir, { recursive: true, withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const fullPath = join(entry.parentPath, entry.name);
      const raw = await readFile(fullPath, 'utf-8').catch(() => '');
      const hits = findForbiddenPatterns(raw);
      if (hits.length > 0) {
        findings.push(`secret-leak suspect in ${fullPath}: ${hits[0]}…`);
      }
    }
  } catch {
    // state dir does not yet exist; that is fine
  }

  return { ok: findings.length === 0, findings };
}

export function buildDeployCommand(): Command {
  const cmd = new Command('deploy').description(
    'deploy an image to a docker-compatible target (compose-ssh, coolify [planned], fly [planned])',
  );

  cmd
    .option('--target <target>', 'compose-ssh | coolify | caprover | fly | none')
    .option('--host <host>', 'ssh://user@host or unix:///var/run/docker.sock')
    .option('--auth <env-var>', 'env-var NAME (never the value) holding the auth secret')
    .option('--image <ref>', 'image reference; defaults to manifest registry/imageName:latest')
    .option('--rollback-on-fail', 'auto-rollback on health failure (default true)', true)
    .option('--dry-run', 'render plan and exit without deploying')
    .action(async (opts: RunDeployInput) => {
      const spinner = ora('Deploying brand site…').start();
      try {
        const result = await runDeploy(opts);
        if (!result.ok) {
          spinner.fail(chalk.red(result.reason ?? 'deploy failed'));
          process.exit(1);
        }
        spinner.succeed(chalk.green(`Deployed ${result.imageRef}`));
        if (result.liveUrl) {
          console.log(chalk.cyan(`  Live URL: ${result.liveUrl}`));
        }
        if (result.reason) console.log(chalk.dim('  ' + result.reason));
      } catch (err) {
        spinner.fail(chalk.red(err instanceof Error ? err.message : String(err)));
        process.exit(1);
      }
    });

  cmd
    .command('status')
    .description('show the last deploy entry')
    .action(async () => {
      const stateDir = join(process.cwd(), DEFAULT_STATE_DIR);
      const last = await readLastDeploy(stateDir);
      if (!last) {
        console.log(chalk.dim('no deploys recorded yet'));
        return;
      }
      console.log(JSON.stringify(last, null, 2));
    });

  cmd
    .command('doctor')
    .description('preflight: docker present? manifest present? state dir clean?')
    .action(async () => {
      const result = await runDoctor();
      if (result.ok) {
        console.log(chalk.green('OK: deploy preflight passed'));
        return;
      }
      console.log(chalk.red('deploy preflight failures:'));
      for (const f of result.findings) console.log(chalk.yellow('  - ' + f));
      process.exit(1);
    });

  return cmd;
}
