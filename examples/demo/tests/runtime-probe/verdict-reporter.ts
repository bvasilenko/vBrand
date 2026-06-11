// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import type { Reporter, TestCase, TestResult, FullResult } from '@playwright/test/reporter';
import { buildVerdict, type Tally } from './verdict-logic.js';

const EMPTY_TALLY: Tally = { passed: 0, failed: 0, skipped: 0, total: 0 };

class VerdictReporter implements Reporter {
  private tally: Tally = { ...EMPTY_TALLY };

  onTestEnd(_test: TestCase, result: TestResult): void {
    const { status } = result;
    this.tally = {
      total:   this.tally.total + 1,
      passed:  this.tally.passed  + (status === 'passed'  ? 1 : 0),
      failed:  this.tally.failed  + (status !== 'passed' && status !== 'skipped' ? 1 : 0),
      skipped: this.tally.skipped + (status === 'skipped' ? 1 : 0),
    };
  }

  onEnd(_result: FullResult): void {
    process.stdout.write(`\n${buildVerdict(this.tally)}\n`);
  }
}

export default VerdictReporter;
