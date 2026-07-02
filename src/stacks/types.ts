// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { z } from 'zod';

export const STACK_NAMES = ['vite', 'next', 'astro'] as const;
export const StackNameSchema = z.enum(STACK_NAMES);
export type StackName = z.infer<typeof StackNameSchema>;
export const DEFAULT_STACK: StackName = 'vite';

export function parseStack(raw: string | null | undefined): StackName {
  const result = StackNameSchema.safeParse(raw);
  return result.success ? result.data : DEFAULT_STACK;
}
