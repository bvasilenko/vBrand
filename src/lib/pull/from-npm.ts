// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { CandidateDoc, CandidateFields } from './candidate-schema.js';
import { highField, lowField, noneField } from './confidence.js';
import { sourceToSlug } from './slug.js';
import { buildCandidateDoc, emptyFields } from './candidate.js';

const NPM_REGISTRY = 'https://registry.npmjs.org';
const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const DEFAULT_OG: [number, number] = [1200, 630];

interface NpmRegistryResponse {
  name?: string;
  description?: string;
  keywords?: string[];
  homepage?: string;
}

export async function fetchFromNpm(packageName: string): Promise<CandidateDoc> {
  const sourceUri = `npm:${packageName}`;
  const slug = sourceToSlug(sourceUri);

  const url = `${NPM_REGISTRY}/${encodeURIComponent(packageName)}`;
  let data: NpmRegistryResponse;
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'vbrand/0.2.0' },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    data = (await response.json()) as NpmRegistryResponse;
  } catch (err) {
    throw new Error(
      `Failed to fetch npm package: ${packageName}` +
        (err instanceof Error ? `: ${err.message}` : ''),
    );
  }

  const displayName = (data.name ?? packageName).replace(/^@[^/]+\//, '');
  const keywords = data.keywords ?? [];
  const colorKeyword = keywords.find((k) => HEX_RE.test(k));

  const fields: CandidateFields = {
    ...emptyFields(),
    name: highField(displayName, 'npm-registry-name'),
    voiceDescription: data.description
      ? highField(data.description, 'npm-description')
      : noneField('absent-in-source'),
    voiceCanonical: noneField('absent-in-source'),
    colors: colorKeyword
      ? lowField({ primary: colorKeyword }, 'npm-keyword-color', 'heuristic-color')
      : noneField('absent-in-source'),
    typeTokens: noneField('absent-in-source'),
    favicon: noneField('absent-in-source', '--logo <path>'),
    og: highField({ dimensions: DEFAULT_OG }, 'default'),
    icons: noneField('absent-in-source'),
  };

  return buildCandidateDoc(slug, sourceUri, fields);
}
