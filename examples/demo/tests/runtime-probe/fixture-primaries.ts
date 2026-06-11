// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { FIXTURE_SLUGS, loadFixture } from '@booga/vfixtures';

export type FixtureHandle = (typeof FIXTURE_SLUGS)[number];

export interface FixtureMeta {
  readonly handle: FixtureHandle;
  readonly label: string;
  readonly expectedPrimary: string;
}

function deriveFixtureMeta(handle: FixtureHandle): FixtureMeta {
  const fixture = loadFixture(handle);
  return {
    handle,
    label: `${fixture.name} (fixture)`,
    expectedPrimary: (fixture.tokens.color['primary'] ?? '').toLowerCase(),
  };
}

export const ALL_FIXTURE_META: readonly FixtureMeta[] = FIXTURE_SLUGS.map(deriveFixtureMeta);

export const FIXTURE_PRIMARIES: Readonly<Record<FixtureHandle, string>> = Object.fromEntries(
  ALL_FIXTURE_META.map(({ handle, expectedPrimary }) => [handle, expectedPrimary]),
) as Readonly<Record<FixtureHandle, string>>;
