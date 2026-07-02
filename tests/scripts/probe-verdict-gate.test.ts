// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const GATE      = resolve(__dirname, '../../scripts/probe-verdict-gate.mjs');

function makeTest(status: string) { return { status }; }
function makeSpec(tests: ReturnType<typeof makeTest>[]) { return { tests }; }
function makeSuite(file: string, specs: ReturnType<typeof makeSpec>[], suites: unknown[] = []) {
  return { file, specs, suites };
}
function makeJson(suites: unknown[]) { return { suites }; }

function runGate(jsonPath: string): { stdout: string; exitCode: number } {
  const r = spawnSync('node', [GATE, jsonPath], { encoding: 'utf8' });
  return { stdout: r.stdout ?? '', exitCode: r.status ?? 1 };
}

const TEMP: string[] = [];

function writeTempJson(obj: unknown): string {
  const p = join(tmpdir(), `pvg-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  writeFileSync(p, JSON.stringify(obj));
  TEMP.push(p);
  return p;
}

afterEach(() => {
  for (const p of TEMP.splice(0)) {
    if (existsSync(p)) unlinkSync(p);
  }
});

function verdictLine(stdout: string): string {
  return stdout
    .trim()
    .split('\n')
    .find((l) => /^(CLEAN|BUGS|PARTIAL|DEFERRED|UNGROUNDED-CLAIM)/.test(l)) ?? '';
}

describe('probe-verdict-gate - missing results file', () => {
  it('emits UNGROUNDED-CLAIM and exits 1 when the file does not exist', () => {
    const { stdout, exitCode } = runGate('/tmp/nonexistent-pvg-test-file.json');
    expect(verdictLine(stdout)).toMatch(/^UNGROUNDED-CLAIM/);
    expect(exitCode).toBe(1);
  });
});

describe('probe-verdict-gate - UNGROUNDED-CLAIM', () => {
  it('emits UNGROUNDED-CLAIM when there are no tests at all', () => {
    const p = writeTempJson(makeJson([]));
    const { stdout, exitCode } = runGate(p);
    expect(verdictLine(stdout)).toMatch(/^UNGROUNDED-CLAIM/);
    expect(exitCode).toBe(1);
  });

  it('emits "0 probes, 0 bugs, 0/3 axes covered" in the verdict', () => {
    const p = writeTempJson(makeJson([]));
    const { stdout } = runGate(p);
    expect(verdictLine(stdout)).toBe('UNGROUNDED-CLAIM: 0 probes, 0 bugs, 0/3 axes covered');
  });
});

describe('probe-verdict-gate - BUGS', () => {
  it('emits BUGS and exits 1 when a test has status "unexpected"', () => {
    const suite = makeSuite(
      'tests/runtime-probe/stack-axis.test.ts',
      [makeSpec([makeTest('unexpected'), makeTest('expected')])],
    );
    const p = writeTempJson(makeJson([suite]));
    const { stdout, exitCode } = runGate(p);
    expect(verdictLine(stdout)).toMatch(/^BUGS/);
    expect(exitCode).toBe(1);
  });

  it('uses singular "bug" label when exactly one test fails', () => {
    const suite = makeSuite('tests/runtime-probe/stack-axis.test.ts', [makeSpec([makeTest('unexpected')])]);
    const p = writeTempJson(makeJson([suite]));
    const { stdout } = runGate(p);
    expect(verdictLine(stdout)).toContain('1 bug,');
  });

  it('uses plural "bugs" label when more than one test fails', () => {
    const suite = makeSuite('tests/runtime-probe/stack-axis.test.ts', [
      makeSpec([makeTest('unexpected'), makeTest('unexpected')]),
    ]);
    const p = writeTempJson(makeJson([suite]));
    const { stdout } = runGate(p);
    expect(verdictLine(stdout)).toContain('2 bugs,');
  });
});

describe('probe-verdict-gate - PARTIAL', () => {
  it('emits PARTIAL and exits 1 when a test has status "skipped" (and none failed)', () => {
    const suite = makeSuite('tests/runtime-probe/stack-axis.test.ts', [
      makeSpec([makeTest('expected'), makeTest('skipped')]),
    ]);
    const p = writeTempJson(makeJson([suite]));
    const { stdout, exitCode } = runGate(p);
    expect(verdictLine(stdout)).toMatch(/^PARTIAL/);
    expect(exitCode).toBe(1);
  });

  it('BUGS takes precedence over PARTIAL when both skipped and unexpected appear', () => {
    const suite = makeSuite('tests/runtime-probe/stack-axis.test.ts', [
      makeSpec([makeTest('unexpected'), makeTest('skipped')]),
    ]);
    const p = writeTempJson(makeJson([suite]));
    const { stdout, exitCode } = runGate(p);
    expect(verdictLine(stdout)).toMatch(/^BUGS/);
    expect(exitCode).toBe(1);
  });
});

describe('probe-verdict-gate - DEFERRED', () => {
  it('emits DEFERRED when all tests pass but fewer than 3 required axes are covered', () => {
    const suite = makeSuite('tests/runtime-probe/stack-axis.test.ts', [
      makeSpec([makeTest('expected')]),
    ]);
    const p = writeTempJson(makeJson([suite]));
    const { stdout, exitCode } = runGate(p);
    expect(verdictLine(stdout)).toMatch(/^DEFERRED/);
    expect(exitCode).toBe(1);
  });

  it('emits DEFERRED when 2 of 3 required axes are covered', () => {
    const suites = [
      makeSuite('tests/runtime-probe/stack-axis.test.ts', [makeSpec([makeTest('expected')])]),
      makeSuite('tests/runtime-probe/cms-axis.test.ts',   [makeSpec([makeTest('expected')])]),
    ];
    const p = writeTempJson(makeJson(suites));
    const { stdout, exitCode } = runGate(p);
    expect(verdictLine(stdout)).toMatch(/^DEFERRED/);
    expect(exitCode).toBe(1);
  });

  it('verdict detail reports correct axis coverage count', () => {
    const suites = [
      makeSuite('tests/runtime-probe/stack-axis.test.ts', [makeSpec([makeTest('expected')])]),
      makeSuite('tests/runtime-probe/cms-axis.test.ts',   [makeSpec([makeTest('expected')])]),
    ];
    const p = writeTempJson(makeJson(suites));
    const { stdout } = runGate(p);
    expect(verdictLine(stdout)).toContain('2/3 axes covered');
  });
});

describe('probe-verdict-gate - CLEAN', () => {
  it('emits CLEAN and exits 0 when all tests pass and all 3 axes are covered', () => {
    const suites = [
      makeSuite('tests/runtime-probe/stack-axis.test.ts',  [makeSpec([makeTest('expected')])]),
      makeSuite('tests/runtime-probe/cms-axis.test.ts',    [makeSpec([makeTest('expected')])]),
      makeSuite('tests/runtime-probe/deploy-axis.test.ts', [makeSpec([makeTest('expected')])]),
    ];
    const p = writeTempJson(makeJson(suites));
    const { stdout, exitCode } = runGate(p);
    expect(verdictLine(stdout)).toMatch(/^CLEAN/);
    expect(exitCode).toBe(0);
  });

  it('verdict detail shows correct probe count and 3/3 axes covered', () => {
    const suites = [
      makeSuite('tests/runtime-probe/stack-axis.test.ts',  [makeSpec([makeTest('expected'), makeTest('expected')])]),
      makeSuite('tests/runtime-probe/cms-axis.test.ts',    [makeSpec([makeTest('expected')])]),
      makeSuite('tests/runtime-probe/deploy-axis.test.ts', [makeSpec([makeTest('expected')])]),
    ];
    const p = writeTempJson(makeJson(suites));
    const { stdout } = runGate(p);
    expect(verdictLine(stdout)).toBe('CLEAN: 4 probes, 0 bugs, 3/3 axes covered');
  });
});

describe('probe-verdict-gate - flaky-as-pass', () => {
  it('treats status "flaky" as a passing test (does not trigger BUGS)', () => {
    const suites = [
      makeSuite('tests/runtime-probe/stack-axis.test.ts',  [makeSpec([makeTest('flaky')])]),
      makeSuite('tests/runtime-probe/cms-axis.test.ts',    [makeSpec([makeTest('expected')])]),
      makeSuite('tests/runtime-probe/deploy-axis.test.ts', [makeSpec([makeTest('expected')])]),
    ];
    const p = writeTempJson(makeJson(suites));
    const { stdout, exitCode } = runGate(p);
    expect(verdictLine(stdout)).toMatch(/^CLEAN/);
    expect(exitCode).toBe(0);
  });
});

describe('probe-verdict-gate - axis detection', () => {
  it('detects axis from basename matching <name>-axis.test.ts pattern', () => {
    const suites = [
      makeSuite('/absolute/path/to/stack-axis.test.ts',  [makeSpec([makeTest('expected')])]),
      makeSuite('/absolute/path/to/cms-axis.test.ts',    [makeSpec([makeTest('expected')])]),
      makeSuite('/absolute/path/to/deploy-axis.test.ts', [makeSpec([makeTest('expected')])]),
    ];
    const p = writeTempJson(makeJson(suites));
    const { stdout, exitCode } = runGate(p);
    expect(verdictLine(stdout)).toMatch(/^CLEAN/);
    expect(exitCode).toBe(0);
  });

  it('detects axis from .js extension (<name>-axis.test.js)', () => {
    const suites = [
      makeSuite('stack-axis.test.js',  [makeSpec([makeTest('expected')])]),
      makeSuite('cms-axis.test.js',    [makeSpec([makeTest('expected')])]),
      makeSuite('deploy-axis.test.js', [makeSpec([makeTest('expected')])]),
    ];
    const p = writeTempJson(makeJson(suites));
    const { stdout, exitCode } = runGate(p);
    expect(verdictLine(stdout)).toMatch(/^CLEAN/);
    expect(exitCode).toBe(0);
  });

  it('ignores axis-name from files not matching <name>-axis.test.[tj]s pattern', () => {
    const suites = [
      makeSuite('stack-toggle.test.ts', [makeSpec([makeTest('expected')])]),
      makeSuite('cms-toggle.test.ts',   [makeSpec([makeTest('expected')])]),
    ];
    const p = writeTempJson(makeJson(suites));
    const { stdout, exitCode } = runGate(p);
    expect(verdictLine(stdout)).toMatch(/^DEFERRED/);
    expect(exitCode).toBe(1);
  });
});

describe('probe-verdict-gate - nested suite traversal', () => {
  it('counts tests in nested suites toward the total', () => {
    const inner = makeSuite('', [makeSpec([makeTest('expected')])]);
    const outer = makeSuite('tests/runtime-probe/stack-axis.test.ts', [], [inner]);
    const suites = [
      outer,
      makeSuite('tests/runtime-probe/cms-axis.test.ts',    [makeSpec([makeTest('expected')])]),
      makeSuite('tests/runtime-probe/deploy-axis.test.ts', [makeSpec([makeTest('expected')])]),
    ];
    const p = writeTempJson(makeJson(suites));
    const { stdout } = runGate(p);
    expect(verdictLine(stdout)).toContain('3 probes');
  });

  it('inherits parent file path for nested suites missing a file property', () => {
    const inner = { specs: [makeSpec([makeTest('expected')])], suites: [] };
    const outer = { file: 'tests/runtime-probe/stack-axis.test.ts', specs: [], suites: [inner] };
    const suites = [
      outer,
      makeSuite('tests/runtime-probe/cms-axis.test.ts',    [makeSpec([makeTest('expected')])]),
      makeSuite('tests/runtime-probe/deploy-axis.test.ts', [makeSpec([makeTest('expected')])]),
    ];
    const p = writeTempJson(makeJson(suites));
    const { stdout, exitCode } = runGate(p);
    expect(verdictLine(stdout)).toMatch(/^CLEAN/);
    expect(exitCode).toBe(0);
  });
});
