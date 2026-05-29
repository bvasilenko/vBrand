// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..');

function gitignorePatterns(): string[] {
  return readFileSync(join(ROOT, '.gitignore'), 'utf-8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));
}

function isGitIgnored(path: string): boolean {
  return spawnSync('git', ['check-ignore', '-q', path], { cwd: ROOT }).status === 0;
}

function isGitTracked(path: string): boolean {
  return spawnSync('git', ['ls-files', '--error-unmatch', path], {
    cwd: ROOT,
    stdio: 'pipe',
  }).status === 0;
}

describe('.gitignore - required build-artifact exclusion patterns', () => {
  it('excludes TypeScript incremental build cache at any depth via glob', () => {
    expect(gitignorePatterns()).toContain('*.tsbuildinfo');
  });

  it('excludes node_modules directory', () => {
    expect(gitignorePatterns()).toContain('node_modules/');
  });

  it('excludes dist output directory', () => {
    expect(gitignorePatterns()).toContain('dist/');
  });

  it('excludes coverage output directory', () => {
    expect(gitignorePatterns()).toContain('coverage/');
  });

  it('excludes bare .env secret file', () => {
    expect(gitignorePatterns()).toContain('.env');
  });

  it('excludes .env variant secret files via glob', () => {
    expect(gitignorePatterns()).toContain('.env.*');
  });
});

describe('.gitignore - tsbuildinfo pattern effectiveness', () => {
  it('ignores tsconfig.tsbuildinfo at repo root', () => {
    expect(isGitIgnored('tsconfig.tsbuildinfo')).toBe(true);
  });

  it('ignores tsconfig.app.tsbuildinfo (composite-project variant name)', () => {
    expect(isGitIgnored('tsconfig.app.tsbuildinfo')).toBe(true);
  });

  it('ignores tsconfig.node.tsbuildinfo (node config variant name)', () => {
    expect(isGitIgnored('tsconfig.node.tsbuildinfo')).toBe(true);
  });

  it('ignores tsconfig.tsbuildinfo in a nested package directory', () => {
    expect(isGitIgnored('packages/core/tsconfig.tsbuildinfo')).toBe(true);
  });

  it('ignores a deeply nested tsbuildinfo file', () => {
    expect(isGitIgnored('a/b/c/tsconfig.tsbuildinfo')).toBe(true);
  });

  it('does not confuse tsconfig.json with the excluded build cache', () => {
    expect(isGitIgnored('tsconfig.json')).toBe(false);
  });

  it('does not confuse a .json file with the excluded build cache', () => {
    expect(isGitIgnored('tsbuildinfo.json')).toBe(false);
  });
});

describe('git index - build artifacts must not be tracked', () => {
  it('tsconfig.tsbuildinfo is not tracked by the git index', () => {
    expect(isGitTracked('tsconfig.tsbuildinfo')).toBe(false);
  });
});
