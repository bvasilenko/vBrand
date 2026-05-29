// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import type { VbrandType } from '../../schema.js';

export interface MarksFinding {
  source: string;
  reason: 'too-narrow' | 'wrong-aspect' | 'missing-file';
  detail: string;
}

function parseAspectRatio(ratio: string): [number, number] | null {
  const match = /^(\d+(?:\.\d+)?)[:/](\d+(?:\.\d+)?)$/.exec(ratio);
  if (!match) return null;
  return [parseFloat(match[1]!), parseFloat(match[2]!)];
}

export async function runMarksGeometry(
  schema: VbrandType,
  cwd: string,
): Promise<MarksFinding[]> {
  if (!schema.marks?.variants?.length) return [];

  const findings: MarksFinding[] = [];
  const { logoMinWidth, logoAspectRatio, variants } = schema.marks;

  for (const variant of variants) {
    const filePath = join(cwd, variant.source);

    if (!existsSync(filePath)) {
      findings.push({
        source: variant.source,
        reason: 'missing-file',
        detail: `File not found: ${variant.source}`,
      });
      continue;
    }

    let width: number;
    let height: number;
    try {
      const meta = await sharp(filePath).metadata();
      width = meta.width ?? 0;
      height = meta.height ?? 0;
    } catch {
      findings.push({
        source: variant.source,
        reason: 'missing-file',
        detail: `Could not read image metadata: ${variant.source}`,
      });
      continue;
    }

    if (logoMinWidth !== undefined && width < logoMinWidth) {
      findings.push({
        source: variant.source,
        reason: 'too-narrow',
        detail: `Width ${width}px < required ${logoMinWidth}px (logoMinWidth)`,
      });
    }

    if (logoAspectRatio !== undefined) {
      const parsed = parseAspectRatio(logoAspectRatio);
      if (parsed !== null && height > 0) {
        const [aw, ah] = parsed;
        const expected = aw / ah;
        const actual = width / height;
        const tolerance = 0.02;
        if (Math.abs(actual - expected) > tolerance * expected) {
          findings.push({
            source: variant.source,
            reason: 'wrong-aspect',
            detail: `Aspect ratio ${width}:${height} (${actual.toFixed(2)}) does not match required ${logoAspectRatio} (${expected.toFixed(2)})`,
          });
        }
      }
    }
  }

  return findings;
}
