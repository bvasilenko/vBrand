// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { readFileSync } from 'node:fs';
import {
  CandidateDoc,
  CandidateDocSchema,
  CandidateFields,
  FaviconValueSchema,
  OgValueSchema,
  IconsValueSchema,
} from './candidate-schema.js';
import { highField, noneField } from './confidence.js';
import { sourceToSlug } from './slug.js';
import { buildCandidateDoc, emptyFields } from './candidate.js';

export function loadFromLocal(filePath: string): CandidateDoc {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch (err) {
    throw new Error(
      `Cannot read local schema: ${filePath}` +
        (err instanceof Error ? `: ${err.message}` : ''),
    );
  }

  if (isRecord(raw) && raw['$candidate'] === true) {
    return CandidateDocSchema.parse(raw);
  }

  return buildFromPartialData(raw, filePath);
}

function buildFromPartialData(raw: unknown, sourceUri: string): CandidateDoc {
  const data = isRecord(raw) ? raw : {};
  const slug = sourceToSlug(sourceUri);
  const base = emptyFields();

  const fields: CandidateFields = {
    ...base,
    name: extractString(data['name'])
      ? highField(extractString(data['name'])!, 'local-field')
      : noneField('absent-in-source'),

    voiceCanonical: extractString((isRecord(data['voice']) ? data['voice'] : {})['canonical'])
      ? highField(extractString((isRecord(data['voice']) ? data['voice'] : {})['canonical'])!, 'local-field')
      : noneField('absent-in-source'),

    voiceDescription: extractString((isRecord(data['voice']) ? data['voice'] : {})['repoDescription'])
      ? highField(extractString((isRecord(data['voice']) ? data['voice'] : {})['repoDescription'])!, 'local-field')
      : noneField('absent-in-source'),

    colors: extractStringRecord((isRecord(data['tokens']) ? data['tokens'] : {})['color'])
      ? highField(extractStringRecord((isRecord(data['tokens']) ? data['tokens'] : {})['color'])!, 'local-field')
      : noneField('absent-in-source'),

    typeTokens: extractStringRecord((isRecord(data['tokens']) ? data['tokens'] : {})['type'])
      ? highField(extractStringRecord((isRecord(data['tokens']) ? data['tokens'] : {})['type'])!, 'local-field')
      : noneField('absent-in-source'),

    favicon: (() => {
      const parsed = FaviconValueSchema.safeParse(
        (isRecord(data['assets']) ? data['assets'] : {})['favicon'],
      );
      return parsed.success
        ? highField(parsed.data, 'local-field')
        : noneField('absent-in-source');
    })(),

    og: (() => {
      const parsed = OgValueSchema.safeParse(
        (isRecord(data['assets']) ? data['assets'] : {})['og'],
      );
      return parsed.success
        ? highField(parsed.data, 'local-field')
        : noneField('absent-in-source');
    })(),

    icons: (() => {
      const parsed = IconsValueSchema.safeParse(
        (isRecord(data['assets']) ? data['assets'] : {})['icons'],
      );
      return parsed.success
        ? highField(parsed.data, 'local-field')
        : noneField('absent-in-source');
    })(),

    marks: data['marks'] !== undefined
      ? highField(data['marks'], 'local-field')
      : noneField('absent-in-source'),

    themes: data['themes'] !== undefined
      ? highField(data['themes'], 'local-field')
      : noneField('absent-in-source'),

    illustration: data['illustration'] !== undefined
      ? highField(data['illustration'], 'local-field')
      : noneField('absent-in-source'),

    slots: data['slots'] !== undefined
      ? highField(data['slots'], 'local-field')
      : noneField('absent-in-source'),

    fusePolicies: data['fusePolicies'] !== undefined
      ? highField(data['fusePolicies'], 'local-field')
      : noneField('absent-in-source'),
  };

  return buildCandidateDoc(slug, sourceUri, fields);
}

function isRecord(val: unknown): val is Record<string, unknown> {
  return val !== null && typeof val === 'object' && !Array.isArray(val);
}

function extractString(val: unknown): string | undefined {
  return typeof val === 'string' && val.length > 0 ? val : undefined;
}

function extractStringRecord(val: unknown): Record<string, string> | undefined {
  if (!isRecord(val)) return undefined;
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(val)) {
    if (typeof v !== 'string') return undefined;
    result[k] = v;
  }
  return result;
}
