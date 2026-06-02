// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { z } from 'zod';

export const DensitySchema = z.enum(['compact', 'regular', 'spacious']);
export type Density = z.infer<typeof DensitySchema>;

export const SectionSpecSchema = z.object({
  id: z.string().min(1),
  visible: z.boolean(),
  density: DensitySchema,
  order: z.number().int().nonnegative(),
});
export type SectionSpec = z.infer<typeof SectionSpecSchema>;

export const CompositionSpecSchema = z.object({
  sections: z.array(SectionSpecSchema).min(1),
});
export type CompositionSpec = z.infer<typeof CompositionSpecSchema>;

const HASH_KEY = 'composition';

export function encodeComposition(spec: CompositionSpec): string {
  return btoa(JSON.stringify(spec));
}

export function decodeComposition(encoded: string): CompositionSpec | null {
  try {
    const decoded: unknown = JSON.parse(atob(encoded));
    const result = CompositionSpecSchema.safeParse(decoded);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function compositionFromHash(hash: string): CompositionSpec | null {
  const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  const encoded = params.get(HASH_KEY);
  return encoded ? decodeComposition(encoded) : null;
}

export function compositionToHash(spec: CompositionSpec): string {
  return `#${HASH_KEY}=${encodeComposition(spec)}`;
}

export function sectionsByOrder(spec: CompositionSpec): SectionSpec[] {
  return [...spec.sections].sort((a, b) => a.order - b.order);
}

export function visibleSections(spec: CompositionSpec): SectionSpec[] {
  return sectionsByOrder(spec).filter((s) => s.visible);
}

export function updateSection(
  spec: CompositionSpec,
  id: string,
  patch: Partial<Omit<SectionSpec, 'id'>>,
): CompositionSpec {
  return {
    ...spec,
    sections: spec.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)),
  };
}

export function reorderSections(
  spec: CompositionSpec,
  fromOrder: number,
  toOrder: number,
): CompositionSpec {
  const sorted = sectionsByOrder(spec);
  const [moved] = sorted.splice(fromOrder, 1);
  sorted.splice(toOrder, 0, moved);
  return {
    ...spec,
    sections: sorted.map((s, i) => ({ ...s, order: i })),
  };
}
