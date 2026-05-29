// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import {
  CandidateDoc,
  CandidateFields,
  DegradationEntry,
  AssetProvenance,
} from './candidate-schema.js';
import { noneField } from './confidence.js';

export function emptyFields(): CandidateFields {
  return {
    name:             noneField('absent-in-source'),
    voiceCanonical:   noneField('absent-in-source'),
    voiceDescription: noneField('absent-in-source'),
    colors:           noneField('absent-in-source'),
    typeTokens:       noneField('absent-in-source'),
    favicon:          noneField('absent-in-source'),
    og:               noneField('absent-in-source'),
    icons:            noneField('absent-in-source'),
    marks:            noneField('absent-in-source'),
    themes:           noneField('absent-in-source'),
    illustration:     noneField('absent-in-source'),
    slots:            noneField('absent-in-source'),
    fusePolicies:     noneField('absent-in-source'),
  };
}

export function buildCandidateDoc(
  slug: string,
  sourceUri: string,
  fields: CandidateFields,
  degradations: DegradationEntry[] = [],
  assets: AssetProvenance[] = [],
): CandidateDoc {
  return {
    $candidate: true,
    slug,
    sourceUri,
    fields,
    provenance: {
      pulledAt: new Date().toISOString(),
      degradations,
      assets,
    },
  };
}
