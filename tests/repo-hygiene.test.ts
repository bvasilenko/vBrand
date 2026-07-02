// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { beforeAll, describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..');

function currentPackageTarballName(): string {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8')) as { name: string; version: string };
  const scope = pkg.name.replace(/^@/, '').replace('/', '-');
  return `${scope}-${pkg.version}.tgz`;
}

function packageScripts(): Record<string, string> {
  return (JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8')) as { scripts: Record<string, string> }).scripts;
}

function shellWords(command: string): string[] {
  return command.split(/\s+/).filter(Boolean);
}

function scriptContainsFlag(scriptName: string, flag: string): boolean {
  return shellWords(packageScripts()[scriptName] ?? '').includes(flag);
}

function composeScriptInvocation(scriptName: string, ...args: string[]): string {
  return [...shellWords(packageScripts()[scriptName] ?? ''), ...args].join(' ');
}

function packageExports(): Record<string, { import: string; types: string }> {
  return (JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8')) as { exports: Record<string, { import: string; types: string }> }).exports;
}

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

  it('excludes npm-pack tarball artifacts via glob', () => {
    expect(gitignorePatterns()).toContain('*.tgz');
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

  it('current version pack tarball is not tracked by the git index', () => {
    expect(isGitTracked(currentPackageTarballName())).toBe(false);
  });
});

describe('.gitignore - generated test-run artefact hygiene', () => {
  it('excludes Playwright and Vitest test-results directories at their generated locations', () => {
    expect(gitignorePatterns()).toContain('/test-results/');
    expect(gitignorePatterns()).toContain('examples/demo/test-results/');
  });

  it.each([
    'test-results/.last-run.json',
    'test-results/runtime-probe/error-context.md',
    'test-results/screenshots/home-page.png',
    'examples/demo/test-results/.last-run.json',
    'examples/demo/test-results/runtime-probe/error-context.md',
    'examples/demo/test-results/screenshots/home-page.png',
  ])('ignores generated test result artefact %s', (path) => {
    expect(isGitIgnored(path)).toBe(true);
  });

  it.each([
    'src/test-results.ts',
    'tests/test-results.test.ts',
    'examples/demo/src/test-results-view.tsx',
  ])('does not ignore source or test files that merely contain test-results in the name: %s', (path) => {
    expect(isGitIgnored(path)).toBe(false);
  });

  it.each([
    'test-results/.last-run.json',
    'examples/demo/test-results/.last-run.json',
  ])('does not track runner-generated state file %s', (path) => {
    expect(isGitTracked(path)).toBe(false);
  });
});

// D-7 contract: tsup transient sidecar files are redirected to node_modules/.cache/tsup/
// by the bundle-require output redirect, so .gitignore does not need (and must not have)
// a pattern masking them at the project root.  Any regression in the redirect is
// immediately visible in git status because root-level bundled_* files are NOT ignored.
describe('.gitignore - tsup transient build-config redirect contract', () => {
  it('does not contain a tsup.config.bundled_*.mjs gitignore pattern (redirect makes it unnecessary)', () => {
    expect(gitignorePatterns()).not.toContain('tsup.config.bundled_*.mjs');
  });

  it('a tsup.config.bundled_*.mjs file at the project root is NOT gitignored (regression is immediately visible)', () => {
    expect(isGitIgnored('tsup.config.bundled_abc123.mjs')).toBe(false);
    expect(isGitIgnored('tsup.config.bundled_zzzzzzzzzzz.mjs')).toBe(false);
    expect(isGitIgnored('tsup.config.bundled_000000000.mjs')).toBe(false);
  });

  it('node_modules/ pattern covers the redirect cache dir node_modules/.cache/tsup/ without a dedicated entry', () => {
    expect(gitignorePatterns()).toContain('node_modules/');
    expect(isGitIgnored('node_modules/.cache/tsup/tsup.config.bundled_abc.mjs')).toBe(true);
  });

  it('does not exclude the real tsup config source file tsup.config.mjs', () => {
    expect(isGitIgnored('tsup.config.mjs')).toBe(false);
  });

  it('does not exclude a tsup bundled file with a non-mjs extension', () => {
    expect(isGitIgnored('tsup.config.bundled_abc.ts')).toBe(false);
    expect(isGitIgnored('tsup.config.bundled_abc.cjs')).toBe(false);
  });
});

describe('package.json build script - redirect wrapper wiring contract', () => {
  it('build script does not invoke tsup as a bare shell command (uses the redirect wrapper instead)', () => {
    const build = packageScripts()['build'];
    expect(build).not.toMatch(/(?:^|&&\s*)tsup(?:\s|$)/);
  });

  it('build script invokes node scripts/run-tsup.cjs as the tsup driver', () => {
    expect(packageScripts()['build']).toContain('node scripts/run-tsup.cjs');
  });

  it('redirect wrapper script exists on disk', () => {
    expect(existsSync(join(ROOT, 'scripts/run-tsup.cjs'))).toBe(true);
  });

  it('bundle-require output-redirect script exists on disk', () => {
    expect(existsSync(join(ROOT, 'scripts/bundle-require-output-redirect.cjs'))).toBe(true);
  });

  it('bundle-require redirect patterns module exists on disk', () => {
    expect(existsSync(join(ROOT, 'scripts/bundle-require-redirect-patterns.cjs'))).toBe(true);
  });
});

describe('package.json scripts - caller-controlled flag convention', () => {
  const callerControlledScripts = [
    ['test', 'vitest run'],
    ['test:watch', 'vitest'],
  ] as const;

  const callerFlags = [
    '--coverage',
    '--reporter',
    '--watch',
    '--runInBand',
  ] as const;

  it.each(callerControlledScripts)('%s script keeps its stable base command', (scriptName, expected) => {
    expect(packageScripts()[scriptName]).toBe(expected);
  });

  it.each(callerControlledScripts.flatMap(([scriptName]) => callerFlags.map((flag) => [scriptName, flag] as const)))(
    '%s script leaves caller flag %s to the invoking command',
    (scriptName, flag) => {
      expect(scriptContainsFlag(scriptName, flag)).toBe(false);
    },
  );

  it.each([
    [['--coverage'], 'vitest run --coverage'],
    [['--reporter=line'], 'vitest run --reporter=line'],
  ] as const)('test script composes caller arguments %s', (args, expected) => {
    expect(composeScriptInvocation('test', ...args)).toBe(expected);
  });
});

describe('npm pack --dry-run - tarball file list correctness', () => {
  let packFilePaths: string[] = [];

  beforeAll(() => {
    if (!existsSync(join(ROOT, 'dist'))) {
      const buildResult = spawnSync('bun', ['run', 'build'], {
        cwd: ROOT,
        encoding: 'utf-8',
        stdio: 'pipe',
      });
      if (buildResult.status !== 0) {
        throw new Error(`pre-pack build failed: ${buildResult.stderr}`);
      }
    }
    const result = spawnSync('npm', ['pack', '--dry-run', '--json'], {
      cwd: ROOT,
      encoding: 'utf-8',
    });
    packFilePaths = JSON.parse(result.stdout ?? '[]')?.[0]?.files?.map(
      (f: { path: string }) => f.path,
    ) ?? [];
  });

  it('vbrand/.cache/ does not appear in the packed file list', () => {
    expect(packFilePaths.filter((p) => p.includes('.cache'))).toHaveLength(0);
  });

  it('dist/ directory is present in the packed file list', () => {
    expect(packFilePaths.some((p) => p.startsWith('dist/'))).toBe(true);
  });

  it('no absolute paths leak into the packed file list', () => {
    expect(packFilePaths.every((p) => !p.startsWith('/'))).toBe(true);
  });
});

describe('public browser-safe subpath exports', () => {
  const BROWSER_SAFE_SUBPATHS = [
    { subpath: './deploy/metadata', importPath: 'dist/deploy-metadata.js', typesPath: 'dist/deploy-metadata.d.ts' },
  ] as const;
  const NODE_BUILTIN_SPECIFIERS = [
    'node:child_process',
    'node:fs',
    'node:fs/promises',
    'node:os',
    'node:path',
    'node:crypto',
    'child_process',
    'fs/promises',
  ] as const;

  it.each(BROWSER_SAFE_SUBPATHS)('$subpath has import and type exports pointing at dist artefacts', ({ subpath, importPath, typesPath }) => {
    const exported = packageExports()[subpath];
    expect(exported?.import).toBe(`./${importPath}`);
    expect(exported?.types).toBe(`./${typesPath}`);
  });

  it.each(BROWSER_SAFE_SUBPATHS)('$subpath build output contains no Node-only module imports', ({ importPath }) => {
    const bundled = readFileSync(join(ROOT, importPath), 'utf-8');
    for (const specifier of NODE_BUILTIN_SPECIFIERS) expect(bundled).not.toContain(specifier);
  });

  it.each(BROWSER_SAFE_SUBPATHS)('$subpath type output exists next to its runtime output', ({ importPath, typesPath }) => {
    expect(existsSync(join(ROOT, importPath))).toBe(true);
    expect(existsSync(join(ROOT, typesPath))).toBe(true);
  });
});
