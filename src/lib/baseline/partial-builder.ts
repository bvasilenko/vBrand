// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import type { BaselinePartial } from './types.js';
import {
  BASELINE_CACHE_REL_DIR,
  BASELINE_COLOR_PRIMARY,
  BASELINE_COLOR_SECONDARY,
  BASELINE_FAVICON_SIZES,
  BASELINE_ICON_SET,
  BASELINE_NAME,
  BASELINE_OG_DIMENSIONS,
  BASELINE_TYPE_BODY,
  BASELINE_TYPE_HEADING,
  BASELINE_VOICE_CANONICAL,
  BASELINE_VOICE_REPO_DESCRIPTION,
  ICONS_SUB_DIR,
  PLACEHOLDER_FAVICON_FILENAME,
} from './schema-values.js';

export function buildBaselinePartial(): BaselinePartial {
  return {
    name: BASELINE_NAME,
    voice: {
      canonical: BASELINE_VOICE_CANONICAL,
      repoDescription: BASELINE_VOICE_REPO_DESCRIPTION,
    },
    assets: {
      favicon: {
        source: `${BASELINE_CACHE_REL_DIR}/${PLACEHOLDER_FAVICON_FILENAME}`,
        sizes: BASELINE_FAVICON_SIZES,
      },
      og: {
        dimensions: BASELINE_OG_DIMENSIONS,
      },
      icons: {
        source: `${BASELINE_CACHE_REL_DIR}/${ICONS_SUB_DIR}`,
        set: BASELINE_ICON_SET,
      },
    },
    tokens: {
      color: {
        primary: BASELINE_COLOR_PRIMARY,
        secondary: BASELINE_COLOR_SECONDARY,
      },
      type: {
        body: BASELINE_TYPE_BODY,
        heading: BASELINE_TYPE_HEADING,
      },
    },
  };
}
