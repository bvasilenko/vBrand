// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { z } from 'zod';
import { ConfidenceLevelSchema } from './confidence.js';

export const FaviconValueSchema = z.object({
  source: z.string().min(1),
  sizes: z.array(z.number().int().positive()).min(1),
});
export const OgValueSchema = z.object({
  source: z.string().min(1).optional(),
  dimensions: z.tuple([z.number().int().positive(), z.number().int().positive()]),
});
export const IconsValueSchema = z.object({
  source: z.string().min(1),
  set: z.array(z.string()),
});

export type FaviconValue = z.infer<typeof FaviconValueSchema>;
export type OgValue = z.infer<typeof OgValueSchema>;
export type IconsValue = z.infer<typeof IconsValueSchema>;

const fieldOf = <T extends z.ZodTypeAny>(valueSchema: T) =>
  z.object({
    value: valueSchema.nullable(),
    confidence: ConfidenceLevelSchema,
    source: z.string().optional(),
    reason: z.string().optional(),
    suggestion: z.string().optional(),
  });

export const DegradationEntrySchema = z.object({
  step: z.string(),
  reason: z.string(),
  detail: z.string().optional(),
});
export type DegradationEntry = z.infer<typeof DegradationEntrySchema>;

export const AssetProvenanceSchema = z.object({
  field: z.string(),
  sourceUrl: z.string(),
  localPath: z.string(),
});
export type AssetProvenance = z.infer<typeof AssetProvenanceSchema>;

export const CandidateFieldsSchema = z.object({
  name:             fieldOf(z.string()),
  voiceCanonical:   fieldOf(z.string()),
  voiceDescription: fieldOf(z.string()),
  colors:           fieldOf(z.record(z.string(), z.string())),
  typeTokens:       fieldOf(z.record(z.string(), z.string())),
  favicon:          fieldOf(FaviconValueSchema),
  og:               fieldOf(OgValueSchema),
  icons:            fieldOf(IconsValueSchema),
  marks:            fieldOf(z.unknown()),
  themes:           fieldOf(z.unknown()),
  illustration:     fieldOf(z.unknown()),
  slots:            fieldOf(z.unknown()),
  fusePolicies:     fieldOf(z.unknown()),
});
export type CandidateFields = z.infer<typeof CandidateFieldsSchema>;

export const CandidateDocSchema = z.object({
  $candidate: z.literal(true),
  slug: z.string(),
  sourceUri: z.string(),
  fields: CandidateFieldsSchema,
  provenance: z.object({
    pulledAt: z.string(),
    degradations: z.array(DegradationEntrySchema),
    assets: z.array(AssetProvenanceSchema),
  }),
});
export type CandidateDoc = z.infer<typeof CandidateDocSchema>;
