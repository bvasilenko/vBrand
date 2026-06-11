// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko

export type VerdictTag = 'CLEAN' | 'BUGS' | 'PARTIAL' | 'UNGROUNDED-CLAIM';

export interface Tally {
  readonly passed: number;
  readonly failed: number;
  readonly skipped: number;
  readonly total: number;
}

export function deriveTag(tally: Tally): VerdictTag {
  if (tally.total === 0) return 'UNGROUNDED-CLAIM';
  if (tally.failed > 0) return 'BUGS';
  if (tally.skipped > 0) return 'PARTIAL';
  return 'CLEAN';
}

export function buildVerdict(tally: Tally): string {
  const tag = deriveTag(tally);
  const covered = tally.passed + tally.failed;
  const bugLabel = tally.failed === 1 ? 'bug' : 'bugs';
  const detail = [
    `${tally.total} probes`,
    `${tally.failed} ${bugLabel}`,
    `${covered}/${tally.total} surfaces covered`,
  ].join(', ');
  return `${tag}: ${detail}`;
}
