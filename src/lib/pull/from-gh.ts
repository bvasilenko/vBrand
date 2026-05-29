// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseHtml } from 'node-html-parser';
import {
  CandidateDoc,
  CandidateFields,
  DegradationEntry,
  AssetProvenance,
} from './candidate-schema.js';
import { highField, mediumField, lowField, noneField } from './confidence.js';
import { sourceToSlug } from './slug.js';
import { buildCandidateDoc, emptyFields } from './candidate.js';
import { cacheAsset } from './asset-cache.js';

const GH_API = 'https://api.github.com';
const GH_UA = 'vbrand/0.2.0';
const DEFAULT_SIZES: [number, ...number[]] = [16, 32, 180, 512];
const DEFAULT_OG: [number, number] = [1200, 630];

interface GhUser {
  name?: string;
  bio?: string;
  blog?: string;
  avatar_url?: string;
}

interface GhRepo {
  name: string;
  description?: string;
  topics?: string[];
  fork: boolean;
  archived: boolean;
}

interface GhProfileFixture {
  user?: GhUser;
  repos?: GhRepo[];
  profileHtml?: string;
}

function loadFixture(fixtureDir: string, handle: string): GhProfileFixture {
  const path = join(fixtureDir, `${handle}.json`);
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as GhProfileFixture;
  } catch {
    throw new Error(`GH fixture not found: ${path}`);
  }
}

function extractPinnedDescriptions(html: string): string[] {
  const root = parseHtml(html, { comment: false });
  const pinned = root.querySelectorAll(
    'div.pinned-item-list-item-content p.pinned-item-desc',
  );
  if (pinned.length > 0) return pinned.map((el) => el.text.trim()).filter(Boolean);
  const fallback = root.querySelectorAll('[class*="pinned"] p');
  return fallback.map((el) => el.text.trim()).filter(Boolean);
}

function extractUserFromHtml(html: string): Partial<GhUser> {
  const root = parseHtml(html, { comment: false });
  const partial: Partial<GhUser> = {};

  const nameEl =
    root.querySelector('[itemprop="name"]') ?? root.querySelector('.p-name');
  const bioEl =
    root.querySelector('[data-bio-text]') ?? root.querySelector('.p-note');
  const avatarEl =
    root.querySelector('img.avatar-user') ??
    root.querySelector('[itemprop="image"]');

  const name = nameEl?.text.trim();
  if (name) partial.name = name;

  const bio =
    bioEl?.getAttribute('data-bio-text') ?? bioEl?.text.trim();
  if (bio) partial.bio = bio;

  const src = avatarEl?.getAttribute('src');
  if (src) partial.avatar_url = src;

  return partial;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { 'User-Agent': GH_UA, Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`GitHub API ${response.status}: ${url}`);
  return response.json() as Promise<T>;
}

async function fetchText(url: string): Promise<string | undefined> {
  try {
    const response = await fetch(url, { headers: { 'User-Agent': GH_UA } });
    return response.ok ? response.text() : undefined;
  } catch {
    return undefined;
  }
}

const HEX_RE = /#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;

async function buildFromProfileData(
  handle: string,
  user: GhUser,
  repos: GhRepo[],
  pinnedDescriptions: string[],
  cacheBase?: string,
): Promise<CandidateDoc> {
  const sourceUri = `gh:${handle}`;
  const slug = sourceToSlug(sourceUri);
  const degradations: DegradationEntry[] = [];
  const assets: AssetProvenance[] = [];

  const activeRepos = repos.filter((r) => !r.fork && !r.archived);
  const topics = new Set<string>();
  for (const repo of activeRepos) {
    for (const topic of repo.topics ?? []) topics.add(topic);
  }

  const fullText = [
    user.bio ?? '',
    ...pinnedDescriptions,
    ...activeRepos.slice(0, 5).map((r) => r.description ?? ''),
  ]
    .filter(Boolean)
    .join(' ');

  const colorMatches = [...fullText.matchAll(HEX_RE)].map((m) => `#${m[1]}`);
  const uniqueColors = [...new Set(colorMatches)].slice(0, 4);

  const displayName = user.name ?? handle;

  const fields: CandidateFields = {
    ...emptyFields(),
    name: user.name
      ? highField(displayName, 'github-profile-name')
      : mediumField(displayName, 'github-handle'),
    voiceCanonical: user.bio
      ? highField(user.bio, 'github-bio')
      : noneField('absent-in-source'),
    voiceDescription: pinnedDescriptions.length > 0
      ? highField(pinnedDescriptions[0]!, 'pinned-repo')
      : user.bio
        ? mediumField(user.bio, 'github-bio')
        : noneField('absent-in-source'),
    colors: uniqueColors.length > 0
      ? lowField(
          Object.fromEntries(uniqueColors.map((c, i) => [i === 0 ? 'primary' : `color-${i}`, c])),
          'bio-text-extraction',
          'heuristic-color',
        )
      : noneField('absent-in-source'),
    typeTokens: noneField('absent-in-source'),
    og: highField({ dimensions: DEFAULT_OG }, 'default'),
    icons: noneField('absent-in-source'),
  };

  if (user.avatar_url) {
    if (cacheBase) {
      const cacheDir = join(cacheBase, slug);
      const { result, degradation } = await cacheAsset(user.avatar_url, cacheDir, 'avatar');
      if (degradation) degradations.push(degradation);
      if (result.kind === 'hit') {
        assets.push({ field: 'assets.favicon', sourceUrl: user.avatar_url, localPath: result.localPath });
        fields.favicon = lowField(
          { source: result.localPath, sizes: DEFAULT_SIZES },
          'github-avatar',
          'avatar-not-brand-mark',
        );
      } else {
        fields.favicon = noneField('download-failed', '--logo <path>');
      }
    } else {
      fields.favicon = lowField(
        { source: user.avatar_url, sizes: DEFAULT_SIZES },
        'github-avatar',
        'avatar-not-brand-mark',
      );
    }
  }

  return buildCandidateDoc(slug, sourceUri, fields, degradations, assets);
}

export async function fetchFromGh(handle: string, cacheBase?: string): Promise<CandidateDoc> {
  const fixtureDir = process.env['VBRAND_GH_FIXTURE_DIR'];

  if (fixtureDir) {
    const fixture = loadFixture(fixtureDir, handle);
    const pinnedDescriptions = fixture.profileHtml
      ? extractPinnedDescriptions(fixture.profileHtml)
      : [];
    return buildFromProfileData(handle, fixture.user ?? {}, fixture.repos ?? [], pinnedDescriptions, cacheBase);
  }

  const [profileHtml, repos] = await Promise.all([
    fetchText(`https://github.com/${handle}`),
    fetchJson<GhRepo[]>(`${GH_API}/users/${handle}/repos?per_page=100&type=owner`),
  ]);

  let user: GhUser = {};
  const pinnedDescriptions: string[] = [];

  if (profileHtml) {
    user = { ...extractUserFromHtml(profileHtml) };
    pinnedDescriptions.push(...extractPinnedDescriptions(profileHtml));
  }

  if (!user.name) {
    const restUser = await fetchJson<GhUser>(`${GH_API}/users/${handle}`);
    user = { ...restUser, ...user };
  }

  return buildFromProfileData(handle, user, repos, pinnedDescriptions, cacheBase);
}
