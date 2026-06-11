// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import type { VbrandType } from '../../schema.js';
import { classifyFetchError } from './cors-error.js';
import { deriveGithubBrandColor } from './github-color.js';

const GH_API = 'https://api.github.com';
const GH_UA = 'vbrand/0.4.0';

interface GitHubRepoResponse {
  name: string;
  full_name: string;
  description: string | null;
  owner: { login: string; avatar_url: string };
  homepage: string | null;
  topics?: string[];
  language: string | null;
}

export async function buildBrandFromGitHubMetadata(
  owner: string,
  repo: string,
): Promise<VbrandType> {
  let data: GitHubRepoResponse;
  try {
    const res = await fetch(`${GH_API}/repos/${owner}/${repo}`, {
      headers: { 'User-Agent': GH_UA },
    });
    if (!res.ok) {
      throw new Error(`GitHub API responded with HTTP ${res.status} for ${owner}/${repo}`);
    }
    data = (await res.json()) as GitHubRepoResponse;
  } catch (err) {
    throw classifyFetchError(`${GH_API}/repos/${owner}/${repo}`, err);
  }

  const displayName = data.full_name ?? `${owner}/${repo}`;
  const description = data.description ?? displayName;
  const avatarUrl = data.owner?.avatar_url ?? `https://github.com/${owner}.png`;
  const primaryColor = deriveGithubBrandColor(data.language);

  return {
    name: displayName,
    voice: {
      canonical: description,
      repoDescription: description,
    },
    assets: {
      favicon: { source: avatarUrl, sizes: [32] },
      og: { dimensions: [1200, 630] },
      icons: { source: avatarUrl, set: [] },
    },
    tokens: {
      color: primaryColor != null ? { primary: primaryColor } : {},
      type: {},
    },
    sources: [`github:${owner}/${repo}`],
  };
}
