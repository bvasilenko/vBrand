// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { z } from 'zod';

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
            source: z.string().min(1),
            dimensions: z.tuple([z.number().int().positive(), z.number().int().positive()]),
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
      })
      .strict(),
  })
  .strict();

export type BrandOs = z.infer<typeof VbrandSchema>;

export const SCHEMA_FILENAME = 'vbrand.schema.json';
