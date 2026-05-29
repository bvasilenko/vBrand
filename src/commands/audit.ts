// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dirExists, fileExists } from '../lib/fs.js';
import { diffDirHashes, hashDir } from '../lib/hash.js';
import { VbrandType, SCHEMA_FILENAME } from '../schema.js';
import { loadSchema } from '../lib/schema-io.js';
import { runEmit } from './emit.js';
import { runAxe, AxeFinding } from '../lib/audit/axe-runner.js';
import { checkSlots, SlotFinding } from '../lib/audit/slot-checker.js';
import { compareSchemas, AlignmentDrift } from '../lib/audit/alignment.js';
import { runContrastCheck, ContrastFinding } from '../lib/audit/contrast-runner.js';
import { runMarksGeometry, MarksFinding } from '../lib/audit/marks-geometry.js';
import { writeAuditReport } from '../lib/audit/report.js';
import { parseLocator } from '../lib/pull/locator.js';
import { fetchFromUrl } from '../lib/pull/from-url.js';
import { fetchFromGh } from '../lib/pull/from-gh.js';
import { fetchFromNpm } from '../lib/pull/from-npm.js';
import { loadFromLocal } from '../lib/pull/from-local.js';
import { stripEnvelopes } from '../lib/fuse/candidate-reader.js';

export interface AuditOptions {
  cwd?: string;
  schemaPath?: string;
  strict?: boolean;
  against?: string;
}

export interface AuditResult {
  clean: boolean;
  drifted: string[];
  axeFindings: AxeFinding[];
  slotFindings: SlotFinding[];
  alignmentDrifts: AlignmentDrift[];
  contrastFindings: ContrastFinding[];
  marksFindings: MarksFinding[];
  reportPath?: string;
}

async function gatherHtmlFiles(brandDir: string): Promise<string[]> {
  if (!dirExists(brandDir)) return [];
  try {
    return readdirSync(brandDir)
      .filter((f) => f.endsWith('.html'))
      .map((f) => join(brandDir, f));
  } catch {
    return [];
  }
}

async function pullExternal(source: string): Promise<Partial<VbrandType>> {
  const locator = parseLocator(source);
  let doc;
  switch (locator.type) {
    case 'local':
      doc = loadFromLocal(locator.value);
      break;
    case 'url':
      doc = await fetchFromUrl(locator.value);
      break;
    case 'gh':
      doc = await fetchFromGh(locator.value);
      break;
    case 'npm':
      doc = await fetchFromNpm(locator.value);
      break;
  }
  return stripEnvelopes(doc, 'low');
}

export async function runAudit(opts: AuditOptions = {}): Promise<AuditResult> {
  const cwd = opts.cwd ?? process.cwd();
  const schemaPath = opts.schemaPath ?? join(cwd, SCHEMA_FILENAME);
  const strict = opts.strict ?? false;

  if (!fileExists(schemaPath)) {
    throw new Error(`Schema not found: ${schemaPath}`);
  }

  const schema = loadSchema(schemaPath);
  const brandDir = join(cwd, 'public', 'brand');

  if (!dirExists(brandDir)) {
    return {
      clean: false,
      drifted: ['public/brand/ (not emitted)'],
      axeFindings: [],
      slotFindings: [],
      alignmentDrifts: [],
      contrastFindings: [],
      marksFindings: [],
    };
  }

  let drifted: string[] = [];
  const tmpDir = mkdtempSync(join(tmpdir(), 'vbrand-audit-'));
  try {
    await runEmit({ cwd: tmpDir, schemaPath });
    const tmpBrandDir = join(tmpDir, 'public', 'brand');
    const expectedHashes = hashDir(tmpBrandDir);
    const actualHashes = hashDir(brandDir);
    drifted = diffDirHashes(expectedHashes, actualHashes);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }

  const htmlFiles = await gatherHtmlFiles(brandDir);
  const axeFindings: AxeFinding[] = [];
  for (const htmlFile of htmlFiles) {
    const { readFileSync } = await import('node:fs');
    const html = readFileSync(htmlFile, 'utf-8');
    const findings = await runAxe(html);
    axeFindings.push(...findings);
  }

  const slotFindings: SlotFinding[] = checkSlots(schema);

  let alignmentDrifts: AlignmentDrift[] = [];
  if (opts.against) {
    const external = await pullExternal(opts.against);
    alignmentDrifts = compareSchemas(schema, external);
  }

  const contrastFindings = runContrastCheck(schema);
  const marksFindings = await runMarksGeometry(schema, cwd);

  const failingContrast = contrastFindings.filter((f) => !f.pass);
  const allFindings = [
    ...drifted,
    ...axeFindings,
    ...slotFindings,
    ...alignmentDrifts,
    ...failingContrast,
    ...marksFindings,
  ];
  const clean = allFindings.length === 0;
  const reportsDir = join(cwd, 'reports');
  const reportPath = writeAuditReport(
    {
      schemaPath,
      drifted,
      axeFindings,
      slotFindings,
      alignmentDrifts,
      contrastFindings,
      marksFindings,
      againstSource: opts.against,
      strict,
      exitCode: strict && !clean ? 1 : 0,
    },
    reportsDir,
  );

  return { clean, drifted, axeFindings, slotFindings, alignmentDrifts, contrastFindings, marksFindings, reportPath };
}
