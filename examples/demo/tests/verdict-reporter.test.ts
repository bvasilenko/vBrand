// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { describe, it, expect, vi } from 'vitest';
import type { TestCase, TestResult, FullResult } from '@playwright/test/reporter';
import VerdictReporter from './runtime-probe/verdict-reporter.js';

type PlaywrightStatus = TestResult['status'];
type ProbeEvent = { file: string; status: PlaywrightStatus };

function makeTest(file: string): TestCase {
  return { location: { file, column: 0, line: 1 } } as unknown as TestCase;
}

function makeResult(status: PlaywrightStatus): TestResult {
  return { status } as unknown as TestResult;
}

function makeFullResult(): FullResult {
  return { status: 'passed', startTime: new Date(), duration: 0 } as unknown as FullResult;
}

const AXIS_FILES = {
  stack:  'stack-axis.test.ts',
  cms:    'cms-axis.test.ts',
  deploy: 'deploy-axis.test.ts',
} as const;

const NON_AXIS_FILE = 'theme-apply.test.ts';

const ALL_AXES_PASS: ProbeEvent[] = [
  { file: AXIS_FILES.stack,  status: 'passed' },
  { file: AXIS_FILES.cms,    status: 'passed' },
  { file: AXIS_FILES.deploy, status: 'passed' },
];

function fire(reporter: VerdictReporter, events: ProbeEvent[]): void {
  for (const { file, status } of events) {
    reporter.onTestEnd(makeTest(file), makeResult(status));
  }
  reporter.onEnd(makeFullResult());
}

function runProbes(events: ProbeEvent[], exit = vi.fn()): { exit: ReturnType<typeof vi.fn> } {
  const reporter = new VerdictReporter({ exit });
  fire(reporter, events);
  return { exit };
}

function captureVerdict(events: ProbeEvent[]): string {
  const chunks: string[] = [];
  const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
    chunks.push(String(chunk));
    return true;
  });
  try {
    runProbes(events);
  } finally {
    spy.mockRestore();
  }
  return chunks.join('');
}

describe('onTestEnd - tally accumulation: status classification', () => {
  it.each<[PlaywrightStatus, string]>([
    ['failed',      'BUGS'],
    ['timedOut',    'BUGS'],
    ['interrupted', 'BUGS'],
  ])('%s status is classified as a failure, not a skip (verdict: %s)', (status, tag) => {
    const verdict = captureVerdict([
      { file: AXIS_FILES.stack,  status },
      { file: AXIS_FILES.cms,    status: 'passed' },
      { file: AXIS_FILES.deploy, status: 'passed' },
    ]);
    expect(verdict).toContain(`${tag}:`);
    expect(verdict).not.toContain('PARTIAL:');
  });

  it('skipped status is classified as a skip, not a failure (verdict: PARTIAL)', () => {
    const verdict = captureVerdict([
      { file: NON_AXIS_FILE,     status: 'skipped' },
      { file: AXIS_FILES.stack,  status: 'passed' },
      { file: AXIS_FILES.cms,    status: 'passed' },
      { file: AXIS_FILES.deploy, status: 'passed' },
    ]);
    expect(verdict).toContain('PARTIAL:');
    expect(verdict).not.toContain('BUGS:');
  });

  it('passed status is neutral — does not increment failure or skip counters', () => {
    const verdict = captureVerdict(ALL_AXES_PASS);
    expect(verdict).toMatch(/^CLEAN:/m);
  });

  it('multiple tests accumulate their tallies independently across a run', () => {
    const verdict = captureVerdict([
      { file: AXIS_FILES.stack,  status: 'passed' },
      { file: AXIS_FILES.stack,  status: 'failed' },
      { file: AXIS_FILES.cms,    status: 'passed' },
      { file: AXIS_FILES.deploy, status: 'passed' },
    ]);
    expect(verdict).toContain('BUGS:');
    expect(verdict).toContain('4 probes');
  });
});

describe('onTestEnd - axis collection', () => {
  it('a passed test from an axis file credits that axis toward coverage', () => {
    const verdict = captureVerdict(ALL_AXES_PASS);
    expect(verdict).toMatch(/^CLEAN:/m);
  });

  it('a skipped test from an axis file does not credit the axis', () => {
    const { exit } = runProbes([
      { file: AXIS_FILES.stack,  status: 'passed' },
      { file: AXIS_FILES.cms,    status: 'passed' },
      { file: AXIS_FILES.deploy, status: 'skipped' },
    ]);
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('a non-axis file test does not credit any required axis regardless of status', () => {
    const { exit } = runProbes([
      { file: NON_AXIS_FILE, status: 'passed' },
      { file: NON_AXIS_FILE, status: 'passed' },
    ]);
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('multiple passed tests from the same axis file credit that axis exactly once', () => {
    const verdict = captureVerdict([
      { file: AXIS_FILES.stack, status: 'passed' },
      { file: AXIS_FILES.stack, status: 'passed' },
      { file: AXIS_FILES.stack, status: 'passed' },
      { file: AXIS_FILES.stack, status: 'passed' },
      { file: AXIS_FILES.stack, status: 'passed' },
      { file: AXIS_FILES.cms,    status: 'passed' },
      { file: AXIS_FILES.deploy, status: 'passed' },
    ]);
    expect(verdict).toContain('3/3 axes covered');
    expect(verdict).toMatch(/^CLEAN:/m);
  });

  it('all three required axes are each credited independently by their own axis file', () => {
    const verdict = captureVerdict(ALL_AXES_PASS);
    expect(verdict).toContain('3/3 axes covered');
  });

  it('extra tests from non-axis files do not inflate the covered-axis count', () => {
    const verdict = captureVerdict([
      ...ALL_AXES_PASS,
      { file: NON_AXIS_FILE, status: 'passed' },
      { file: NON_AXIS_FILE, status: 'passed' },
    ]);
    expect(verdict).toContain('3/3 axes covered');
    expect(verdict).toMatch(/^CLEAN:/m);
  });
});

describe('onEnd - exit enforcement', () => {
  it('does not call exit when verdict is CLEAN (all axes pass, no failures or skips)', () => {
    const { exit } = runProbes(ALL_AXES_PASS);
    expect(exit).not.toHaveBeenCalled();
  });

  it.each<[string, ProbeEvent[]]>([
    [
      'UNGROUNDED-CLAIM: no tests ran at all',
      [],
    ],
    [
      'DEFERRED: required axis (deploy) not covered',
      [
        { file: AXIS_FILES.stack, status: 'passed' },
        { file: AXIS_FILES.cms,   status: 'passed' },
      ],
    ],
    [
      'DEFERRED: no axis probe files included in the run',
      [{ file: NON_AXIS_FILE, status: 'passed' }],
    ],
    [
      'BUGS: at least one test failed',
      [
        { file: AXIS_FILES.stack,  status: 'failed' },
        { file: AXIS_FILES.cms,    status: 'passed' },
        { file: AXIS_FILES.deploy, status: 'passed' },
      ],
    ],
    [
      'BUGS: test timed out (timedOut counts as failure, not skip)',
      [
        { file: AXIS_FILES.stack,  status: 'timedOut' },
        { file: AXIS_FILES.cms,    status: 'passed' },
        { file: AXIS_FILES.deploy, status: 'passed' },
      ],
    ],
    [
      'BUGS: test interrupted (interrupted counts as failure, not skip)',
      [
        { file: AXIS_FILES.stack,  status: 'interrupted' },
        { file: AXIS_FILES.cms,    status: 'passed' },
        { file: AXIS_FILES.deploy, status: 'passed' },
      ],
    ],
    [
      'PARTIAL: at least one test was skipped',
      [
        { file: NON_AXIS_FILE,     status: 'skipped' },
        { file: AXIS_FILES.stack,  status: 'passed' },
        { file: AXIS_FILES.cms,    status: 'passed' },
        { file: AXIS_FILES.deploy, status: 'passed' },
      ],
    ],
  ])('calls exit(1) when verdict is %s', (_label, events) => {
    const { exit } = runProbes(events);
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('calls exit with code 1, not 0 or any other code', () => {
    const { exit } = runProbes([]);
    expect(exit).toHaveBeenCalledWith(1);
    expect(exit).not.toHaveBeenCalledWith(0);
  });

  it('calls exit exactly once per onEnd invocation regardless of how many tests failed', () => {
    const { exit } = runProbes([
      { file: AXIS_FILES.stack,  status: 'failed' },
      { file: AXIS_FILES.cms,    status: 'failed' },
      { file: AXIS_FILES.deploy, status: 'failed' },
    ]);
    expect(exit).toHaveBeenCalledTimes(1);
  });
});

describe('constructor - exit injection', () => {
  it('uses the provided exit function, not process.exit, when an override is given', () => {
    const customExit = vi.fn();
    const reporter = new VerdictReporter({ exit: customExit });
    fire(reporter, []);
    expect(customExit).toHaveBeenCalled();
  });

  it('falls back to process.exit when no exit option is provided', () => {
    const spy = vi.spyOn(process, 'exit').mockImplementation((_code) => undefined as never);
    try {
      const reporter = new VerdictReporter();
      fire(reporter, []);
      expect(spy).toHaveBeenCalledWith(1);
    } finally {
      spy.mockRestore();
    }
  });

  it('each reporter instance maintains its own injected exit function', () => {
    const exitA = vi.fn();
    const exitB = vi.fn();
    runProbes([], exitA);
    runProbes(ALL_AXES_PASS, exitB);
    expect(exitA).toHaveBeenCalledWith(1);
    expect(exitB).not.toHaveBeenCalled();
  });
});
