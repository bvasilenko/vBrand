// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { VbrandType } from '../../schema.js';

export interface AlignmentDrift {
  field: string;
  schemaValue: string;
  externalValue: string;
}

function normalizeColorHex(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (trimmed.startsWith('#') && trimmed.length === 4) {
    const r = trimmed[1]!;
    const g = trimmed[2]!;
    const b = trimmed[3]!;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return trimmed;
}

export function compareSchemas(
  schema: VbrandType,
  external: Partial<VbrandType>,
): AlignmentDrift[] {
  const drifts: AlignmentDrift[] = [];

  if (external.name && external.name !== schema.name) {
    drifts.push({ field: 'name', schemaValue: schema.name, externalValue: external.name });
  }

  const externalColors = external.tokens?.color ?? {};
  for (const [key, schemaVal] of Object.entries(schema.tokens.color)) {
    const extVal = externalColors[key];
    if (extVal && normalizeColorHex(extVal) !== normalizeColorHex(schemaVal)) {
      drifts.push({
        field: `tokens.color.${key}`,
        schemaValue: schemaVal,
        externalValue: extVal,
      });
    }
  }

  return drifts;
}
