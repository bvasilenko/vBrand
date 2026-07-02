// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import fs from 'node:fs';
import { FIXTURES } from './axes.mjs';
import { loadFixture } from '@booga/vfixtures';

export function loadExpectedPrimaries() {
  return Object.fromEntries(
    FIXTURES.map((slug) => [slug, (loadFixture(slug).tokens.color?.primary ?? '').toLowerCase()]),
  );
}

function failureReason(result, expectedPrimaries) {
  if (result.error) return `navigation error: ${result.error}`;
  const expected = expectedPrimaries[result.fixture];
  if (expected && result.primary.toLowerCase() !== expected) {
    return `color mismatch: expected ${expected}, got ${result.primary}`;
  }
  if (result.mode !== 'spa' && result.iframeSheetCount < 2) {
    return `iframe stylesheet count ${result.iframeSheetCount} < 2`;
  }
  if (result.mode === 'hybrid' && result.islandCount < 1) {
    return `hybrid island count ${result.islandCount} < 1`;
  }
  return null;
}

export function writeManifest(results, destPath, expectedPrimaries) {
  const entries = results.map(({ thumbnail: _t, ...rest }) => ({
    ...rest,
    expectedPrimary: expectedPrimaries[rest.fixture] ?? null,
    primaryMatch:    rest.primary?.toLowerCase() === (expectedPrimaries[rest.fixture] ?? ''),
  }));
  fs.writeFileSync(destPath, JSON.stringify(entries, null, 2));
}

export function printDiffReport(results, expectedPrimaries) {
  const failures = results.filter((r) => failureReason(r, expectedPrimaries) !== null);
  if (failures.length === 0) {
    process.stdout.write(`\nAll ${results.length} cells passed automated diff checks.\n`);
    return;
  }
  process.stdout.write(`\n${failures.length} cell(s) flagged for chief-executive review:\n`);
  for (const f of failures) {
    process.stdout.write(`  [${f.fixture}/${f.app}/${f.mode}] ${failureReason(f, expectedPrimaries)}\n`);
  }
}
