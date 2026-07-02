// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko

export type VerdictTag = 'CLEAN' | 'BUGS' | 'PARTIAL' | 'DEFERRED' | 'UNGROUNDED-CLAIM';

export interface Tally {
  readonly passed: number;
  readonly failed: number;
  readonly skipped: number;
  readonly total: number;
  readonly axes?: readonly string[];
  readonly requiredAxes?: readonly string[];
}

export const REQUIRED_AXIS_NAMES = ['stack', 'cms', 'deploy'] as const;

export function axisFromProbeFile(file: string): string | null {
  const match = /(?:^|[/\\])([a-z]+)-axis\.test\.[tj]s$/.exec(file);
  return match?.[1] ?? null;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

export function deriveTag(tally: Tally): VerdictTag {
  if (tally.total === 0) return 'UNGROUNDED-CLAIM';
  if (tally.failed > 0) return 'BUGS';
  if (tally.skipped > 0) return 'PARTIAL';
  if (tally.axes !== undefined) {
    const covered = new Set(tally.axes);
    const required = tally.requiredAxes ?? REQUIRED_AXIS_NAMES;
    if (!required.every((axis) => covered.has(axis))) return 'DEFERRED';
  }
  return 'CLEAN';
}

export function buildVerdict(tally: Tally): string {
  const tag = deriveTag(tally);
  const axes = uniqueSorted(tally.axes ?? []);
  const requiredAxes = uniqueSorted(tally.requiredAxes ?? REQUIRED_AXIS_NAMES);
  const bugLabel = tally.failed === 1 ? 'bug' : 'bugs';
  const coveredRequiredAxes = axes.filter((axis) => requiredAxes.includes(axis));
  const axisDetail = `${coveredRequiredAxes.length}/${requiredAxes.length} axes covered`;
  const detail = [
    `${tally.total} probes`,
    `${tally.failed} ${bugLabel}`,
    axisDetail,
  ].join(', ');
  return `${tag}: ${detail}`;
}
