// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import type { CmsSubstrateAdapter } from './index.js';
import { loadFixtureContentTree, loadFixtureSchema, resolveFixtureSlug } from './content-tree.js';

export const vbrandStandaloneCms: CmsSubstrateAdapter = {
  name: () => 'vbrand-standalone',
  loadContent: async (slug) => loadFixtureContentTree(resolveFixtureSlug(slug)),
  loadSchema: async () => loadFixtureSchema(),
};
