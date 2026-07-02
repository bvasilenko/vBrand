// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { CompositionSpec } from '../composition/spec.js';
import type { ContentTree } from '../cms/types.js';
import type { DeploymentTargetAdapter, DeployBundle, DeployResult } from './contract.js';
import { buildStaticDeployBundle } from './bundle.js';

const HOSTED_URL = 'https://bvasilenko.github.io/vBrand/';

export type GhPagesRunner = (dir: string) => Promise<DeployResult>;
export type GhPagesEmitter = (composition: CompositionSpec, content: ContentTree) => Promise<DeployBundle>;

async function materializeBundle(bundle: DeployBundle): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vbrand-gh-pages-'));
  for (const file of bundle.files) {
    const target = path.join(dir, file.path);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.contents);
  }
  return dir;
}

export function runGhPagesCli(dir: string): Promise<DeployResult> {
  const started = Date.now();
  return new Promise((resolve) => {
    const child = spawn('npx', ['gh-pages', '-d', dir], { stdio: ['ignore', 'pipe', 'pipe'] });
    const logs: string[] = [];
    child.stdout.on('data', (chunk) => logs.push(String(chunk)));
    child.stderr.on('data', (chunk) => logs.push(String(chunk)));
    child.on('error', (err) => resolve({ url: HOSTED_URL, logs: [err.message], status: 'failed', durationMs: Date.now() - started }));
    child.on('close', (code) => resolve({ url: HOSTED_URL, logs, status: code === 0 ? 'ok' : 'failed', durationMs: Date.now() - started }));
  });
}

function demoDistDir(): string {
  return path.resolve(process.cwd(), 'examples/demo/dist');
}

const defaultEmit: GhPagesEmitter = (_composition, content) =>
  buildStaticDeployBundle({ distDir: demoDistDir(), content });

export function createGhPagesTarget(run: GhPagesRunner = runGhPagesCli, emit: GhPagesEmitter = defaultEmit): DeploymentTargetAdapter {
  return {
    name: () => 'gh-pages',
    emitArtifact(composition: CompositionSpec, content: ContentTree): Promise<DeployBundle> {
      return emit(composition, content);
    },
    async deployBundle(bundle: DeployBundle): Promise<DeployResult> {
      const dir = await materializeBundle(bundle);
      return run(dir);
    },
  };
}

export const ghPagesTarget: DeploymentTargetAdapter = createGhPagesTarget();
