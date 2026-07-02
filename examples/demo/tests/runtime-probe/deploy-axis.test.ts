// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildStaticDeployBundle, createGhPagesTarget, DECOUPLED_FOR_LATER_MESSAGE, DEPLOY_TARGET_REGISTRY } from '../../../../dist/deploy.js';

const composition = { sections: [{ id: 'hero', visible: true, density: 'regular' as const, order: 0 }] };
const content = { 'landing.hero.heading': 'Deploy probe' };
const hostedResult = {
  url: 'https://bvasilenko.github.io/vBrand/',
  logs: ['mocked'],
  status: 'ok' as const,
  durationMs: 1,
};

async function demoDistFixture(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vbrand-runtime-deploy-'));
  await fs.mkdir(path.join(dir, 'assets'), { recursive: true });
  await fs.writeFile(path.join(dir, 'index.html'), '<!doctype html><html><body><main>runtime deploy fixture</main><script type="module" src="/assets/index.js"></script></body></html>');
  await fs.writeFile(path.join(dir, 'assets', 'index.js'), 'window.__runtimeDeployFixture = true;');
  return dir;
}

test('deploy-axis probe validates gh-pages bundle and deferred slots', async () => {
  const distDir = await demoDistFixture();
  const bundle = await buildStaticDeployBundle({ distDir, content });
  const paths = bundle.files.map((file) => file.path);
  expect(bundle.manifest.primaryEntry).toBe('index.html');
  expect(paths).toContain('index.html');
  expect(paths).toContain('404.html');
  expect(paths.some((file) => file.startsWith('assets/'))).toBe(true);
  expect(paths.some((file) => file.startsWith('data/'))).toBe(true);
  for (const [name, adapter] of Object.entries(DEPLOY_TARGET_REGISTRY)) {
    if (name === 'gh-pages') continue;
    await expect(adapter.deployBundle(bundle)).rejects.toThrow(DECOUPLED_FOR_LATER_MESSAGE);
  }
  const mockedGhPages = createGhPagesTarget(async () => hostedResult);
  await expect(mockedGhPages.deployBundle(bundle)).resolves.toMatchObject({ status: 'ok', logs: ['mocked'] });
});
