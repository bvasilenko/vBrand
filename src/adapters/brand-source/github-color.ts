// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { GITHUB_LANGUAGE_COLORS } from './github-language-colors.js';

export function deriveGithubBrandColor(language: string | null | undefined): string | undefined {
  if (!language) return undefined;
  return GITHUB_LANGUAGE_COLORS[language];
}
