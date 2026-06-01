// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import type { VbrandType } from '../../schema.js';

export async function loadFromFixtureHandle(handle: string): Promise<VbrandType> {
  let mod: { loadFixture: (slug: string) => VbrandType; FIXTURE_SLUGS: readonly string[] };
  try {
    mod = (await import('@booga/vfixtures')) as typeof mod;
  } catch {
    throw new Error(
      '@booga/vfixtures is required for loadFromFixture. Add it as a peer dependency.',
    );
  }
  if (!mod.FIXTURE_SLUGS.includes(handle)) {
    throw new Error(
      `Unknown fixture handle "${handle}". Known: ${mod.FIXTURE_SLUGS.join(', ')}`,
    );
  }
  return mod.loadFixture(handle) as VbrandType;
}
