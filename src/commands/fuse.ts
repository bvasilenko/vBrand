// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { join } from 'node:path';
import { VbrandSchema, VbrandType, SCHEMA_FILENAME } from '../schema.js';
import { loadCandidateDoc, writeSchema } from '../lib/schema-io.js';
import { runScrubGate, loadScrubPatterns } from '../lib/scrub-gate.js';
import { applyStrategy, FuseStrategy } from '../lib/fuse/strategies.js';
import { stripEnvelopes } from '../lib/fuse/candidate-reader.js';
import { ConfidenceLevel } from '../lib/pull/confidence.js';
import { fileExists } from '../lib/fs.js';

export interface FuseOptions {
  strategy?: FuseStrategy;
  cwd?: string;
  schemaPath?: string;
  scrubListPath?: string;
  avatarPath?: string;
  acceptConfidence?: ConfidenceLevel;
}

export interface ScrubFinding {
  field: string;
  value: string;
  pattern: string;
}

export interface FuseResult {
  schema: VbrandType;
  schemaPath: string;
  strategy: FuseStrategy;
  scrubFindings: ScrubFinding[];
}

export async function runFuse(
  inputs: string[],
  opts: FuseOptions = {},
): Promise<FuseResult> {
  if (inputs.length < 2) {
    throw new Error('fuse requires at least two input schema paths');
  }

  const cwd = opts.cwd ?? process.cwd();
  const strategy = opts.strategy ?? 'umbrella-wins';
  const outPath = opts.schemaPath ?? join(cwd, SCHEMA_FILENAME);
  const minConfidence = opts.acceptConfidence ?? 'medium';

  const partials = inputs.map((inputPath) => {
    const doc = loadCandidateDoc(inputPath);
    return stripEnvelopes(doc, minConfidence);
  });

  const merged = applyStrategy(partials as unknown[], strategy);

  let parsed: VbrandType;
  try {
    parsed = VbrandSchema.parse(merged);
  } catch (err) {
    const missing = extractMissingFields(err);
    throw new Error(
      `Cannot produce canonical schema from candidates. Missing required fields: ${missing}. ` +
        `Add more candidate sources or augment manually.`,
    );
  }

  const scrubListPath = opts.scrubListPath ?? join(cwd, 'scrub-list.txt');
  const scrubFindings: ScrubFinding[] = [];

  if (fileExists(scrubListPath)) {
    const patterns = loadScrubPatterns(scrubListPath);
    const raw = runScrubGate(parsed, patterns);
    scrubFindings.push(...raw);
  }

  writeSchema(parsed, outPath);

  return { schema: parsed, schemaPath: outPath, strategy, scrubFindings };
}

function extractMissingFields(err: unknown): string {
  if (err instanceof Error && 'errors' in err) {
    const zodErr = err as { errors: Array<{ path: string[]; message: string }> };
    return zodErr.errors
      .map((e) => e.path.join('.') || e.message)
      .join(', ');
  }
  return String(err);
}
