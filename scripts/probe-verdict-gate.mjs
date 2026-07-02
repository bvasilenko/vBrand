// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { readFileSync, existsSync } from 'node:fs';

const REQUIRED_AXES  = ['stack', 'cms', 'deploy'];
const AXIS_FILE_RE   = /(?:^|[/\\])([a-z]+)-axis\.test\.[tj]s$/;

function axisFromFile(file) {
  return AXIS_FILE_RE.exec(file)?.[1] ?? null;
}

function deriveTag(total, failed, skipped, covered) {
  if (total === 0) return 'UNGROUNDED-CLAIM';
  if (failed > 0)  return 'BUGS';
  if (skipped > 0) return 'PARTIAL';
  if (!REQUIRED_AXES.every((a) => covered.has(a))) return 'DEFERRED';
  return 'CLEAN';
}

function buildVerdict(total, failed, skipped, covered) {
  const tag        = deriveTag(total, failed, skipped, covered);
  const bugLabel   = failed === 1 ? 'bug' : 'bugs';
  const covCount   = REQUIRED_AXES.filter((a) => covered.has(a)).length;
  const detail     = `${total} probes, ${failed} ${bugLabel}, ${covCount}/${REQUIRED_AXES.length} axes covered`;
  return `${tag}: ${detail}`;
}

function collectTests(suites, inheritedFile = '') {
  const out = [];
  for (const suite of suites ?? []) {
    const file = suite.file ?? inheritedFile;
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        out.push({ file, status: test.status });
      }
    }
    out.push(...collectTests(suite.suites, file));
  }
  return out;
}

const resultsPath = process.argv[2];
if (!resultsPath) {
  process.stderr.write('Usage: probe-verdict-gate.mjs <playwright-results.json>\n');
  process.exit(1);
}

if (!existsSync(resultsPath)) {
  const line = 'UNGROUNDED-CLAIM: 0 probes, 0 bugs, 0/3 axes covered';
  process.stdout.write(`\n${line}\n`);
  process.stderr.write(`Results file not found: ${resultsPath}\n`);
  process.exit(1);
}

const json    = JSON.parse(readFileSync(resultsPath, 'utf8'));
const tests   = collectTests(json.suites);
const covered = new Set();
let passed = 0, failed = 0, skipped = 0;

for (const { file, status } of tests) {
  if (status === 'skipped') {
    skipped++;
  } else {
    const isPass = status === 'expected' || status === 'flaky';
    if (isPass) passed++; else failed++;
    const axis = axisFromFile(file);
    if (axis) covered.add(axis);
  }
}

const total   = passed + failed + skipped;
const verdict = buildVerdict(total, failed, skipped, covered);
process.stdout.write(`\n${verdict}\n`);

if (deriveTag(total, failed, skipped, covered) !== 'CLEAN') process.exit(1);
