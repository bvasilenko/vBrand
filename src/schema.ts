// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { z } from 'zod';

export const SCHEMA_FILENAME = 'vbrand.schema.json';

const FusePolicyHintSchema = z.enum([
  'array-union',
  'array-replace',
  'null-delete',
  'null-keep',
]);

export type FusePolicyHint = z.infer<typeof FusePolicyHintSchema>;

const SlotSchema = z
  .object({
    description: z.string().optional(),
    placeholder: z.string().optional(),
    value: z.string().optional(),
    contentType: z
      .enum(['tagline', 'bio', 'readme-intro', 'og-copy', 'voice-sample'])
      .optional(),
    fusePolicy: FusePolicyHintSchema.optional(),
  })
  .strict();

export type Slot = z.infer<typeof SlotSchema>;

const MarkVariantSchema = z
  .object({
    name: z.string().min(1),
    source: z.string().min(1),
    usage: z.string().optional(),
  })
  .strict();

export const ThemeModeValues = ['light', 'dark', 'highContrast', 'lightDim', 'darkDim'] as const;
const ThemeModeSchema = z.enum(ThemeModeValues);
export type ThemeMode = z.infer<typeof ThemeModeSchema>;

export const VbrandSchema = z
  .object({
    name: z.string().min(1),
    voice: z
      .object({
        canonical: z.string().min(1),
        repoDescription: z.string().min(1),
      })
      .strict(),
    assets: z
      .object({
        favicon: z
          .object({
            source: z.string().min(1),
            sizes: z.array(z.number().int().positive()).min(1),
          })
          .strict(),
        og: z
          .object({
            source: z.string().min(1).optional(),
            dimensions: z.tuple([
              z.number().int().positive(),
              z.number().int().positive(),
            ]),
          })
          .strict(),
        icons: z
          .object({
            source: z.string().min(1),
            set: z.array(z.string().min(1)),
          })
          .strict(),
      })
      .strict(),
    tokens: z
      .object({
        color: z.record(z.string(), z.string()),
        type: z.record(z.string(), z.string()),
        spacing: z.record(z.string(), z.string()).optional(),
        radius: z.record(z.string(), z.string()).optional(),
        shadow: z.record(z.string(), z.string()).optional(),
        motion: z.record(z.string(), z.string()).optional(),
        opacity: z.record(z.string(), z.string()).optional(),
        zIndex: z.record(z.string(), z.string()).optional(),
      })
      .strict(),
    sources: z.array(z.string().min(1)).optional(),
    marks: z
      .object({
        logoMinWidth: z.number().int().positive().optional(),
        logoAspectRatio: z.string().optional(),
        safeZoneRatio: z.number().positive().optional(),
        variants: z.array(MarkVariantSchema).optional(),
      })
      .strict()
      .optional(),
    themes: z
      .object({
        modes: z.array(ThemeModeSchema).min(1),
        registry: z
          .record(ThemeModeSchema, z.record(z.string(), z.string()))
          .optional(),
      })
      .strict()
      .optional(),
    illustration: z
      .object({
        style: z.enum(['flat', 'outlined', 'gradient']).optional(),
        palette: z.array(z.string().min(1)).optional(),
        assetDir: z.string().optional(),
      })
      .strict()
      .optional(),
    slots: z.record(z.string(), SlotSchema).optional(),
    fusePolicies: z.record(z.string(), FusePolicyHintSchema).optional(),
    provenance: z
      .object({
        scrubbed_handles: z.array(z.string().min(1)),
      })
      .strict()
      .optional(),
  })
  .strict();

export type VbrandType = z.infer<typeof VbrandSchema>;

export type { VbrandType as BrandOs };
