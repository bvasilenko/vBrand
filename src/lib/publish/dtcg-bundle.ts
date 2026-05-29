// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ensureDir } from '../fs.js';
import { VbrandType } from '../../schema.js';

export const DTCG_EXPERIMENTAL_NOTICE =
  'DTCG Format Module rev 2025.10 is a draft spec. ' +
  'See https://tr.designtokens.org/format/ for current status. ' +
  'Output is lossy vs vTheme schema; field mapping via --mapping=<file> overrides defaults.';

interface DtcgToken {
  $value: string;
  $type: string;
  $description?: string;
}

interface DtcgBundle {
  $metadata: {
    generated: string;
    source: string;
    notice: string;
  };
  [key: string]: unknown;
}

function toDtcgKey(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-');
}

export function buildDtcgBundle(schema: VbrandType): DtcgBundle {
  const bundle: DtcgBundle = {
    $metadata: {
      generated: new Date().toISOString().slice(0, 10),
      source: '@booga/vbrand',
      notice: DTCG_EXPERIMENTAL_NOTICE,
    },
  };

  for (const [key, value] of Object.entries(schema.tokens.color)) {
    const token: DtcgToken = {
      $value: value,
      $type: 'color',
      $description: `${schema.name} color token: ${key}`,
    };
    bundle[toDtcgKey(key)] = token;
  }

  for (const [key, value] of Object.entries(schema.tokens.type)) {
    const token: DtcgToken = {
      $value: value,
      $type: 'fontFamily',
      $description: `${schema.name} typography token: ${key}`,
    };
    bundle[`font-${toDtcgKey(key)}`] = token;
  }

  return bundle;
}

export function writeDtcgBundle(schema: VbrandType, distDir: string): string {
  ensureDir(distDir);
  const bundle = buildDtcgBundle(schema);
  const outPath = join(distDir, 'tokens.dtcg.json');
  writeFileSync(outPath, JSON.stringify(bundle, null, 2) + '\n', 'utf-8');
  return outPath;
}
