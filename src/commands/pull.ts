// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { join } from 'node:path';
import { CandidateDoc } from '../lib/pull/candidate-schema.js';
import { writeCandidateDoc } from '../lib/schema-io.js';
import { detectPI } from '../lib/pi-detect.js';
import { parseLocator } from '../lib/pull/locator.js';
import { fetchFromUrl } from '../lib/pull/from-url.js';
import { fetchFromGh } from '../lib/pull/from-gh.js';
import { fetchFromNpm } from '../lib/pull/from-npm.js';
import { loadFromLocal } from '../lib/pull/from-local.js';
import { sourceToSlug } from '../lib/pull/slug.js';

export interface PullOptions {
  cwd?: string;
  candidateDir?: string;
}

export interface PullResult {
  candidateDoc: CandidateDoc;
  candidatePath: string;
  source: string;
}

async function resolveCandidate(source: string, cacheBase: string): Promise<CandidateDoc> {
  const locator = parseLocator(source);
  switch (locator.type) {
    case 'local':
      return loadFromLocal(locator.value);
    case 'url':
      return fetchFromUrl(locator.value, cacheBase);
    case 'gh':
      return fetchFromGh(locator.value, cacheBase);
    case 'npm':
      return fetchFromNpm(locator.value);
  }
}

export async function runPull(source: string, opts: PullOptions = {}): Promise<PullResult> {
  const cwd = opts.cwd ?? process.cwd();
  const cacheBase = join(cwd, 'vbrand', '.cache');
  const outDir = opts.candidateDir ?? cwd;

  const candidateDoc = await resolveCandidate(source, cacheBase);

  const piFindings = detectPI(candidateDoc);
  if (piFindings.length > 0) {
    const details = piFindings
      .map((f) => `  [${f.field}] ${f.value.slice(0, 60)}`)
      .join('\n');
    throw new Error(
      `Prompt injection detected in source data. Refusing to write candidate.\n${details}`,
    );
  }

  const slug = sourceToSlug(source);
  const candidatePath = join(outDir, `${slug}.candidate.json`);

  writeCandidateDoc(candidateDoc, candidatePath);
  return { candidateDoc, candidatePath, source: parseLocator(source).type };
}
