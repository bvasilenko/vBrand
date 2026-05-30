// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko

import { join } from 'node:path';
import type { CandidateDoc, CandidateFields, DegradationEntry, AssetProvenance } from './candidate-schema.js';
import { highField, noneField } from './confidence.js';
import { extractPageSignals } from './html-signals.js';
import { fetchHtml } from './html-fetcher.js';
import {
  DEFAULT_OG_DIMENSIONS,
  buildNameField,
  buildVoiceCanonicalField,
  buildVoiceDescriptionField,
  buildColorsField,
  buildFaviconField,
} from './field-builders.js';
import { sourceToSlug } from './slug.js';
import { buildCandidateDoc, emptyFields } from './candidate.js';

const DEFAULT_CACHE_ROOT = '/tmp/vbrand-cache';

export async function fetchFromUrl(url: string, cacheBase?: string): Promise<CandidateDoc> {
  const slug      = sourceToSlug(url);
  const cacheDir  = join(cacheBase ?? DEFAULT_CACHE_ROOT, slug);
  const degradations: DegradationEntry[] = [];
  const assets: AssetProvenance[]        = [];

  const outcome = await fetchHtml(url, cacheDir);
  if (!outcome.ok) {
    degradations.push(outcome.degradation);
    return buildCandidateDoc(slug, url, emptyFields(), degradations, assets);
  }

  const signals = extractPageSignals(outcome.html, url);

  const fields: CandidateFields = {
    ...emptyFields(),
    name:             buildNameField(signals, degradations),
    voiceCanonical:   buildVoiceCanonicalField(signals, degradations),
    voiceDescription: buildVoiceDescriptionField(signals, degradations),
    colors:           buildColorsField(signals, degradations),
    favicon:          await buildFaviconField(signals, cacheBase !== undefined ? cacheDir : undefined, degradations, assets),
    og:               highField({ dimensions: DEFAULT_OG_DIMENSIONS }, 'default'),
    icons:            noneField('absent-in-source'),
  };

  return buildCandidateDoc(slug, url, fields, degradations, assets);
}
