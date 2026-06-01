// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko

const GH_API = 'https://api.github.com';
const NPM_REGISTRY = 'https://registry.npmjs.org';
const GH_UA = 'vbrand/0.4.0';

export async function resolveGitHubHomepage(owner: string, repo: string): Promise<string> {
  try {
    const res = await fetch(`${GH_API}/repos/${owner}/${repo}`, {
      headers: { 'User-Agent': GH_UA },
    });
    if (res.ok) {
      const data = (await res.json()) as { homepage?: string | null };
      if (data.homepage) return data.homepage;
    }
  } catch {
  }
  return `https://${owner}.github.io/${repo}`;
}

export async function resolveNpmHomepage(packageName: string): Promise<string> {
  try {
    const res = await fetch(
      `${NPM_REGISTRY}/${encodeURIComponent(packageName)}/latest`,
      { headers: { Accept: 'application/json' } },
    );
    if (res.ok) {
      const data = (await res.json()) as { homepage?: string | null };
      if (data.homepage) return data.homepage;
    }
  } catch {
  }
  return `https://www.npmjs.com/package/${encodeURIComponent(packageName)}`;
}
