// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import NodeModule from 'node:module';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const _require = createRequire(import.meta.url);
const ROOT = join(import.meta.dirname, '../..');

const {
  BUNDLE_REQUIRE_INDEX_CJS_RE,
  ORIGINAL_OUTPUT_FN_RE,
  CACHE_RELATIVE_PATH,
  REDIRECTED_OUTPUT_FN,
  applyOutputRedirect,
}: {
  BUNDLE_REQUIRE_INDEX_CJS_RE: RegExp;
  ORIGINAL_OUTPUT_FN_RE: RegExp;
  CACHE_RELATIVE_PATH: string;
  REDIRECTED_OUTPUT_FN: string;
  applyOutputRedirect: (source: string) => string;
} = _require('../../scripts/bundle-require-redirect-patterns.cjs');

// Module internals: _extensions and _cache are private but stable Node.js APIs.
type NodeModuleInternals = {
  _extensions: Record<string, (m: NodeModule, filename: string) => void>;
  _cache: Record<string, NodeModule>;
};
const ModuleInternals = NodeModule as unknown as NodeModuleInternals;

const BUNDLE_REQUIRE_CJS_PATH = join(ROOT, 'node_modules/bundle-require/dist/index.cjs');
const BUNDLE_REQUIRE_CJS_SOURCE = readFileSync(BUNDLE_REQUIRE_CJS_PATH, 'utf8');
const REDIRECT_SCRIPT_PATH = join(ROOT, 'scripts/bundle-require-output-redirect.cjs');

// The exact four-line function body as it appears in bundle-require's dist artifact.
const ORIGINAL_SNIPPET =
  'var defaultGetOutputFile = (filepath, format) => filepath.replace(\n' +
  '  JS_EXT_RE,\n' +
  '  `.bundled_${getRandomId()}.${format === "esm" ? "mjs" : "cjs"}`\n' +
  ');';

describe('BUNDLE_REQUIRE_INDEX_CJS_RE - path selection contract', () => {
  const MATCHING_PATHS = [
    'node_modules/bundle-require/dist/index.cjs',
    'node_modules\\bundle-require\\dist\\index.cjs',
    '/home/user/project/node_modules/bundle-require/dist/index.cjs',
    'C:\\Users\\user\\project\\node_modules\\bundle-require\\dist\\index.cjs',
    '/workspace/a/b/node_modules/bundle-require/dist/index.cjs',
  ] as const;

  const NON_MATCHING_PATHS = [
    'node_modules/bundle-require/dist/index.js',
    'node_modules/bundle-require/dist/index.mjs',
    'node_modules/bundle-require/dist/other.cjs',
    'node_modules/bundle-require/index.cjs',
    'node_modules/my-bundle-require/dist/index.cjs',
    'node_modules/bundle-require-extra/dist/index.cjs',
    'node_modules/xbundle-require/dist/index.cjs',
    'bundle-require/dist/index.cjs',
    'dist/index.cjs',
    'index.cjs',
    '',
  ] as const;

  it.each(MATCHING_PATHS)(
    'matches the bundle-require CJS entry path: %s',
    (p) => { expect(BUNDLE_REQUIRE_INDEX_CJS_RE.test(p)).toBe(true); },
  );

  it.each(NON_MATCHING_PATHS)(
    'does not match non-bundle-require path: %s',
    (p) => { expect(BUNDLE_REQUIRE_INDEX_CJS_RE.test(p)).toBe(false); },
  );

  it('matches regardless of how many ancestor directory segments precede node_modules', () => {
    expect(BUNDLE_REQUIRE_INDEX_CJS_RE.test('a/b/c/d/node_modules/bundle-require/dist/index.cjs')).toBe(true);
  });

  it('does not match when the dist/ segment is replaced by another directory name', () => {
    expect(BUNDLE_REQUIRE_INDEX_CJS_RE.test('node_modules/bundle-require/src/index.cjs')).toBe(false);
    expect(BUNDLE_REQUIRE_INDEX_CJS_RE.test('node_modules/bundle-require/build/index.cjs')).toBe(false);
  });

  it('requires bundle-require to be a complete directory name, not a substring', () => {
    expect(BUNDLE_REQUIRE_INDEX_CJS_RE.test('node_modules/bundle-require2/dist/index.cjs')).toBe(false);
  });

  it('is anchored to the end of the string (no trailing path segments accepted)', () => {
    expect(BUNDLE_REQUIRE_INDEX_CJS_RE.test('node_modules/bundle-require/dist/index.cjs/extra')).toBe(false);
  });
});

describe('ORIGINAL_OUTPUT_FN_RE - source pattern matching contract', () => {
  it('matches the exact function form from the bundle-require dist artifact', () => {
    expect(ORIGINAL_OUTPUT_FN_RE.test(ORIGINAL_SNIPPET)).toBe(true);
  });

  it('matches when embedded in surrounding source context', () => {
    const context = `some prior code;\n${ORIGINAL_SNIPPET}\nsome following code;`;
    expect(ORIGINAL_OUTPUT_FN_RE.test(context)).toBe(true);
  });

  it('matches the actual bundle-require CJS source file', () => {
    expect(ORIGINAL_OUTPUT_FN_RE.test(BUNDLE_REQUIRE_CJS_SOURCE)).toBe(true);
  });

  it('does not match the redirected replacement form (transform is non-self-matching)', () => {
    expect(ORIGINAL_OUTPUT_FN_RE.test(REDIRECTED_OUTPUT_FN)).toBe(false);
  });

  it('does not match a defaultGetOutputFile that uses a block body instead of concise body', () => {
    const blockForm = 'var defaultGetOutputFile = (filepath, format) => {\n  return filepath;\n};';
    expect(ORIGINAL_OUTPUT_FN_RE.test(blockForm)).toBe(false);
  });

  it('does not match a defaultGetOutputFile using a different method chain', () => {
    const differentChain = 'var defaultGetOutputFile = (filepath, format) => filepath.join(\n  JS_EXT_RE\n);';
    expect(ORIGINAL_OUTPUT_FN_RE.test(differentChain)).toBe(false);
  });

  it('does not match an empty string', () => {
    expect(ORIGINAL_OUTPUT_FN_RE.test('')).toBe(false);
  });

  it('does not match unrelated source code', () => {
    expect(ORIGINAL_OUTPUT_FN_RE.test('var foo = (x) => x + 1; var bar = "hello";')).toBe(false);
  });
});

describe('applyOutputRedirect - source transform contract', () => {
  it('returns a different string when the original pattern is present', () => {
    expect(applyOutputRedirect(ORIGINAL_SNIPPET)).not.toBe(ORIGINAL_SNIPPET);
  });

  it('returns the input unchanged when the pattern is absent', () => {
    const unrelated = 'var x = 1; var y = 2;';
    expect(applyOutputRedirect(unrelated)).toBe(unrelated);
  });

  it('returns an empty string unchanged', () => {
    expect(applyOutputRedirect('')).toBe('');
  });

  it('does not mutate the input string (pure function)', () => {
    const snapshot = ORIGINAL_SNIPPET.slice();
    applyOutputRedirect(ORIGINAL_SNIPPET);
    expect(ORIGINAL_SNIPPET).toBe(snapshot);
  });

  it('is idempotent: applying twice yields the same result as applying once', () => {
    const once = applyOutputRedirect(ORIGINAL_SNIPPET);
    expect(applyOutputRedirect(once)).toBe(once);
  });

  it('output contains the cache-relative path so the temp file is written inside node_modules', () => {
    expect(applyOutputRedirect(ORIGINAL_SNIPPET)).toContain(CACHE_RELATIVE_PATH);
  });

  it('output contains mkdirSync so the cache directory is auto-created on first use', () => {
    expect(applyOutputRedirect(ORIGINAL_SNIPPET)).toContain('mkdirSync');
  });

  it('output retains JS_EXT_RE so file-extension stripping still works', () => {
    expect(applyOutputRedirect(ORIGINAL_SNIPPET)).toContain('JS_EXT_RE');
  });

  it('output retains getRandomId() so each temp filename is unique', () => {
    expect(applyOutputRedirect(ORIGINAL_SNIPPET)).toContain('getRandomId()');
  });

  it('output contains format-based extension branching for esm → mjs and cjs → cjs', () => {
    const result = applyOutputRedirect(ORIGINAL_SNIPPET);
    expect(result).toContain('"esm"');
    expect(result).toContain('"mjs"');
    expect(result).toContain('"cjs"');
  });

  it('output no longer contains the original filepath.replace() concise body', () => {
    expect(applyOutputRedirect(ORIGINAL_SNIPPET)).not.toContain('filepath.replace(');
  });

  it('output contains exactly one defaultGetOutputFile definition', () => {
    const count = (applyOutputRedirect(ORIGINAL_SNIPPET).match(/var defaultGetOutputFile/g) ?? []).length;
    expect(count).toBe(1);
  });

  it('applied to the actual bundle-require CJS source: result contains the cache path', () => {
    expect(applyOutputRedirect(BUNDLE_REQUIRE_CJS_SOURCE)).toContain(CACHE_RELATIVE_PATH);
  });

  it('applied to the actual bundle-require CJS source: original concise body is gone', () => {
    expect(ORIGINAL_OUTPUT_FN_RE.test(applyOutputRedirect(BUNDLE_REQUIRE_CJS_SOURCE))).toBe(false);
  });

  it('applied to the actual bundle-require CJS source: exactly one definition remains', () => {
    const count = (applyOutputRedirect(BUNDLE_REQUIRE_CJS_SOURCE).match(/var defaultGetOutputFile/g) ?? []).length;
    expect(count).toBe(1);
  });

  it('when the snippet appears twice: replaces only the first occurrence (single-replacement contract)', () => {
    const doubled = `${ORIGINAL_SNIPPET}\n${ORIGINAL_SNIPPET}`;
    const result = applyOutputRedirect(doubled);
    expect(result).toContain(CACHE_RELATIVE_PATH);
    expect(ORIGINAL_OUTPUT_FN_RE.test(result)).toBe(true);
    expect((result.match(new RegExp(CACHE_RELATIVE_PATH.replace(/\//g, '\\/'), 'g')) ?? []).length).toBe(1);
  });
});

describe('Module._extensions hook - loader dispatch contract', () => {
  let savedLoader: ((m: NodeModule, filename: string) => void) | undefined;

  beforeEach(() => {
    savedLoader = ModuleInternals._extensions['.js'];
    delete ModuleInternals._cache[BUNDLE_REQUIRE_CJS_PATH];
    delete ModuleInternals._cache[REDIRECT_SCRIPT_PATH];
  });

  afterEach(() => {
    if (savedLoader !== undefined) ModuleInternals._extensions['.js'] = savedLoader;
    delete ModuleInternals._cache[BUNDLE_REQUIRE_CJS_PATH];
    delete ModuleInternals._cache[REDIRECT_SCRIPT_PATH];
  });

  it('installs a replacement for Module._extensions[".js"]', () => {
    const before = ModuleInternals._extensions['.js'];
    _require('../../scripts/bundle-require-output-redirect.cjs');
    expect(ModuleInternals._extensions['.js']).not.toBe(before);
    expect(typeof ModuleInternals._extensions['.js']).toBe('function');
  });

  it('installed hook has the expected function name for debuggability', () => {
    _require('../../scripts/bundle-require-output-redirect.cjs');
    expect(ModuleInternals._extensions['.js'].name).toBe('bundleRequireOutputRedirectLoader');
  });

  it('hook loads bundle-require without throwing (source transform is syntactically valid)', () => {
    _require('../../scripts/bundle-require-output-redirect.cjs');
    delete ModuleInternals._cache[BUNDLE_REQUIRE_CJS_PATH];
    expect(() => _require('../../node_modules/bundle-require/dist/index.cjs')).not.toThrow();
  });

  it('bundleRequire export remains callable after the source transform', () => {
    _require('../../scripts/bundle-require-output-redirect.cjs');
    delete ModuleInternals._cache[BUNDLE_REQUIRE_CJS_PATH];
    const br = _require('../../node_modules/bundle-require/dist/index.cjs') as { bundleRequire: unknown };
    expect(typeof br.bundleRequire).toBe('function');
  });
});

function runSubprocess(inlineScript: string): { stdout: string; status: number | null } {
  const result = spawnSync(process.execPath, ['--eval', inlineScript], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 30_000,
  });
  return { stdout: result.stdout ?? '', status: result.status };
}

const E2E_SCRIPT = `
'use strict';
const path = require('path');
const fs   = require('fs');
require('./scripts/bundle-require-output-redirect.cjs');
const br = require('./node_modules/bundle-require/dist/index.cjs');
br.bundleRequire({ filepath: path.resolve('./tsup.config.mjs') }).then(() => {
  const leaked = fs.readdirSync('.').filter(f => /tsup\\.config\\.bundled_/.test(f));
  const cacheExists = fs.existsSync('./node_modules/.cache/tsup');
  process.stdout.write(JSON.stringify({ leaked, cacheExists }));
}).catch(() => {
  const leaked = fs.readdirSync('.').filter(f => /tsup\\.config\\.bundled_/.test(f));
  const cacheExists = fs.existsSync('./node_modules/.cache/tsup');
  process.stdout.write(JSON.stringify({ leaked, cacheExists }));
});
`;

describe('end-to-end redirect behavior - subprocess contract', () => {
  it('no tsup.config.bundled_* files appear in the project root after bundleRequire completes', () => {
    const { stdout } = runSubprocess(E2E_SCRIPT);
    const { leaked } = JSON.parse(stdout) as { leaked: string[]; cacheExists: boolean };
    expect(leaked).toHaveLength(0);
  });

  it('cache directory node_modules/.cache/tsup is created automatically on first use', () => {
    const { stdout } = runSubprocess(E2E_SCRIPT);
    const { cacheExists } = JSON.parse(stdout) as { leaked: string[]; cacheExists: boolean };
    expect(cacheExists).toBe(true);
  });

  it('no root leak when bundleRequire is called multiple times in sequence', () => {
    const script = `
'use strict';
const path = require('path');
const fs   = require('fs');
require('./scripts/bundle-require-output-redirect.cjs');
const br = require('./node_modules/bundle-require/dist/index.cjs');
const cfg = path.resolve('./tsup.config.mjs');
br.bundleRequire({ filepath: cfg })
  .catch(() => {})
  .then(() => br.bundleRequire({ filepath: cfg }).catch(() => {}))
  .finally(() => {
    const leaked = fs.readdirSync('.').filter(f => /tsup\\.config\\.bundled_/.test(f));
    process.stdout.write(JSON.stringify({ leaked }));
  });
`;
    const { leaked } = JSON.parse(runSubprocess(script).stdout) as { leaked: string[] };
    expect(leaked).toHaveLength(0);
  });

  it('bundleRequire resolves with a valid module object (config is parsed correctly)', () => {
    const script = `
'use strict';
const path = require('path');
require('./scripts/bundle-require-output-redirect.cjs');
const br = require('./node_modules/bundle-require/dist/index.cjs');
br.bundleRequire({ filepath: path.resolve('./tsup.config.mjs') }).then((result) => {
  const hasModule = result.mod && (result.mod.default !== undefined || result.mod.tsup !== undefined);
  process.stdout.write(JSON.stringify({ hasModule: Boolean(hasModule) }));
}).catch(() => {
  process.stdout.write(JSON.stringify({ hasModule: false }));
});
`;
    const { hasModule } = JSON.parse(runSubprocess(script).stdout) as { hasModule: boolean };
    expect(hasModule).toBe(true);
  });
});
