// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import type { ContentTree } from '@booga/vbrand/cms';
import type { ContentOverrideMap } from '@booga/vbrand/content';

export function mergeContentLayers(
  cmsContent: ContentTree,
  userContent: ContentOverrideMap,
): ContentOverrideMap {
  return { ...cmsContent, ...userContent };
}
