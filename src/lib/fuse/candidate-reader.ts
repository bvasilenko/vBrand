// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { CandidateDoc, CandidateFields } from '../pull/candidate-schema.js';
import { ConfidenceLevel, confidenceAtLeast } from '../pull/confidence.js';
import { VbrandType } from '../../schema.js';

export function stripEnvelopes(
  doc: CandidateDoc,
  minConfidence: ConfidenceLevel = 'medium',
): Partial<VbrandType> {
  const { fields } = doc;
  const partial: Record<string, unknown> = {};

  if (meetsThreshold(fields.name, minConfidence)) {
    partial['name'] = fields.name.value;
  }

  const voice = buildVoice(fields, minConfidence);
  if (voice) partial['voice'] = voice;

  const tokens = buildTokens(fields, minConfidence);
  if (tokens) partial['tokens'] = tokens;

  const assets = buildAssets(fields, minConfidence);
  if (assets) partial['assets'] = assets;

  if (meetsThreshold(fields.marks, minConfidence) && fields.marks.value !== null) {
    partial['marks'] = fields.marks.value;
  }
  if (meetsThreshold(fields.themes, minConfidence) && fields.themes.value !== null) {
    partial['themes'] = fields.themes.value;
  }
  if (meetsThreshold(fields.illustration, minConfidence) && fields.illustration.value !== null) {
    partial['illustration'] = fields.illustration.value;
  }
  if (meetsThreshold(fields.slots, minConfidence) && fields.slots.value !== null) {
    partial['slots'] = fields.slots.value;
  }
  if (meetsThreshold(fields.fusePolicies, minConfidence) && fields.fusePolicies.value !== null) {
    partial['fusePolicies'] = fields.fusePolicies.value;
  }

  partial['sources'] = [doc.sourceUri];

  return partial as Partial<VbrandType>;
}

function meetsThreshold(
  field: { confidence: ConfidenceLevel },
  minimum: ConfidenceLevel,
): boolean {
  return field.confidence !== "none" && confidenceAtLeast(field.confidence, minimum);
}

function buildVoice(
  fields: CandidateFields,
  min: ConfidenceLevel,
): Record<string, string> | undefined {
  const voice: Record<string, string> = {};
  if (meetsThreshold(fields.voiceCanonical, min) && fields.voiceCanonical.value !== null) {
    voice['canonical'] = fields.voiceCanonical.value;
  }
  if (meetsThreshold(fields.voiceDescription, min) && fields.voiceDescription.value !== null) {
    voice['repoDescription'] = fields.voiceDescription.value;
  }
  return Object.keys(voice).length > 0 ? voice : undefined;
}

function buildTokens(
  fields: CandidateFields,
  min: ConfidenceLevel,
): Record<string, unknown> | undefined {
  const tokens: Record<string, unknown> = {};
  if (meetsThreshold(fields.colors, min) && fields.colors.value !== null) {
    tokens['color'] = fields.colors.value;
  }
  if (meetsThreshold(fields.typeTokens, min) && fields.typeTokens.value !== null) {
    tokens['type'] = fields.typeTokens.value;
  }
  return Object.keys(tokens).length > 0 ? tokens : undefined;
}

function buildAssets(
  fields: CandidateFields,
  min: ConfidenceLevel,
): Record<string, unknown> | undefined {
  const assets: Record<string, unknown> = {};
  if (meetsThreshold(fields.favicon, min) && fields.favicon.value !== null) {
    assets['favicon'] = fields.favicon.value;
  }
  if (meetsThreshold(fields.og, min) && fields.og.value !== null) {
    assets['og'] = fields.og.value;
  }
  if (meetsThreshold(fields.icons, min) && fields.icons.value !== null) {
    assets['icons'] = fields.icons.value;
  }
  return Object.keys(assets).length > 0 ? assets : undefined;
}
