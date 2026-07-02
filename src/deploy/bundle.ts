// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import crypto from 'node:crypto';
import type { Stats } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { ContentTree } from '../cms/types.js';
import type { DeployBundle, DeployBundleFile } from './contract.js';

export interface StaticDeployBundleOptions {
  readonly distDir: string;
  readonly content?: ContentTree;
}

function isEnoent(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && (err as NodeJS.ErrnoException).code === 'ENOENT';
}

function nodeType(stat: Stats): 'directory' | 'other' {
  return stat.isDirectory() ? 'directory' : 'other';
}

async function assertFile(pathname: string): Promise<void> {
  let stat: Stats;
  try {
    stat = await fs.stat(pathname);
  } catch (err) {
    if (!isEnoent(err)) throw err;
    throw new Error(`MISSING_DEPLOY_ARTEFACT: ${pathname}`);
  }
  if (stat.isFile()) return;
  throw new Error(`DEPLOY_PATH_NOT_A_FILE: ${nodeType(stat)}: ${pathname}`);
}

async function walk(dir: string, prefix = ''): Promise<DeployBundleFile[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: DeployBundleFile[] = [];
  for (const entry of entries) {
    const absolute = path.join(dir, entry.name);
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...await walk(absolute, relative));
    if (entry.isFile()) files.push({ path: relative, contents: await fs.readFile(absolute) });
  }
  return files;
}

function hash(contents: string | Buffer): string {
  return crypto.createHash('sha256').update(contents).digest('hex');
}

function withRequiredStaticFiles(files: readonly DeployBundleFile[], content: ContentTree): DeployBundleFile[] {
  const byPath = new Map(files.map((file) => [file.path, file]));
  const index = byPath.get('index.html');
  if (!index) throw new Error('MISSING_DEPLOY_ARTEFACT: index.html');
  if (![...byPath.keys()].some((file) => file.startsWith('assets/'))) throw new Error('MISSING_DEPLOY_ARTEFACT: assets/');
  if (!byPath.has('404.html')) byPath.set('404.html', { path: '404.html', contents: index.contents });
  if (![...byPath.keys()].some((file) => file.startsWith('data/'))) byPath.set('data/content.json', { path: 'data/content.json', contents: JSON.stringify({ content }, null, 2) });
  return [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path));
}

export async function buildStaticDeployBundle(options: StaticDeployBundleOptions): Promise<DeployBundle> {
  const { distDir } = options;
  await assertFile(path.join(distDir, 'index.html'));
  const files = withRequiredStaticFiles(await walk(distDir), options.content ?? {});
  return { files, manifest: { primaryEntry: 'index.html', assetHashes: Object.fromEntries(files.map((file) => [file.path, hash(file.contents)])) } };
}
