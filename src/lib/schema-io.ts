// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { ensureDir } from './fs.js';
import { VbrandSchema, VbrandType } from '../schema.js';
import { CandidateDoc, CandidateDocSchema } from './pull/candidate-schema.js';

export function loadSchema(schemaPath: string): VbrandType {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(schemaPath, 'utf-8'));
  } catch (err) {
    throw new Error(
      `Schema not found or unreadable: ${schemaPath}` +
        (err instanceof Error ? `: ${err.message}` : ''),
    );
  }
  return VbrandSchema.parse(raw);
}

export function writeSchema(schema: VbrandType, schemaPath: string): void {
  ensureDir(dirname(schemaPath));
  writeFileSync(schemaPath, JSON.stringify(schema, null, 2) + '\n', 'utf-8');
}

export function loadCandidateDoc(filePath: string): CandidateDoc {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch (err) {
    throw new Error(
      `Candidate not found or unreadable: ${filePath}` +
        (err instanceof Error ? `: ${err.message}` : ''),
    );
  }
  if (!isRecord(raw) || raw['$candidate'] !== true) {
    throw new Error(
      `"${filePath}" is not a candidate document. Run "vbrand pull ${filePath}" first.`,
    );
  }
  return CandidateDocSchema.parse(raw);
}

export function writeCandidateDoc(doc: CandidateDoc, filePath: string): void {
  ensureDir(dirname(filePath));
  writeFileSync(filePath, JSON.stringify(doc, null, 2) + '\n', 'utf-8');
}

function isRecord(val: unknown): val is Record<string, unknown> {
  return val !== null && typeof val === 'object' && !Array.isArray(val);
}
