// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import type { Reporter, TestCase, TestResult, FullResult } from '@playwright/test/reporter';
import { axisFromProbeFile, buildVerdict, deriveTag, type Tally } from './verdict-logic.js';

type ExitFn = (code: number) => void;

const EMPTY_TALLY: Tally = { passed: 0, failed: 0, skipped: 0, total: 0 };

class VerdictReporter implements Reporter {
  private tally: Tally = { ...EMPTY_TALLY };
  private axes = new Set<string>();
  private readonly exit: ExitFn;

  constructor(options?: { exit?: ExitFn }) {
    this.exit = options?.exit ?? process.exit;
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const { status } = result;
    const axis = axisFromProbeFile(test.location.file);
    if (axis && status !== 'skipped') this.axes.add(axis);
    this.tally = {
      total:   this.tally.total + 1,
      passed:  this.tally.passed  + (status === 'passed'  ? 1 : 0),
      failed:  this.tally.failed  + (status !== 'passed' && status !== 'skipped' ? 1 : 0),
      skipped: this.tally.skipped + (status === 'skipped' ? 1 : 0),
    };
  }

  onEnd(_result: FullResult): void {
    const tally = { ...this.tally, axes: [...this.axes].sort() };
    process.stdout.write(`\n${buildVerdict(tally)}\n`);
    if (deriveTag(tally) !== 'CLEAN') this.exit(1);
  }
}

export default VerdictReporter;
