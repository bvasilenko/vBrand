// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { z } from 'zod';

export const InteractivityModeSchema = z.enum(['static', 'hybrid', 'spa']);
export type InteractivityMode = z.infer<typeof InteractivityModeSchema>;
export const DEFAULT_MODE: InteractivityMode = 'spa';

export function parseMode(raw: string | null | undefined): InteractivityMode {
  const result = InteractivityModeSchema.safeParse(raw);
  return result.success ? result.data : DEFAULT_MODE;
}
