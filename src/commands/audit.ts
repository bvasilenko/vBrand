// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dirExists, fileExists } from '../lib/fs.js';
import { diffDirHashes, hashDir } from '../lib/hash.js';
import { SCHEMA_FILENAME } from '../schema.js';
import { runEmit } from './emit.js';

export interface AuditOptions {
  cwd?: string;
  schemaPath?: string;
}

export interface AuditResult {
  clean: boolean;
  drifted: string[];
}

export async function runAudit(opts: AuditOptions = {}): Promise<AuditResult> {
  const cwd = opts.cwd ?? process.cwd();
  const schemaPath = opts.schemaPath ?? join(cwd, SCHEMA_FILENAME);

  if (!fileExists(schemaPath)) {
    throw new Error(`Schema not found: ${schemaPath}`);
  }

  const brandDir = join(cwd, 'public', 'brand');
  if (!dirExists(brandDir)) {
    return { clean: false, drifted: ['public/brand/ (not emitted)'] };
  }

  const tmpDir = mkdtempSync(join(tmpdir(), 'vbrand-audit-'));
  try {
    await runEmit({ cwd: tmpDir, schemaPath });
    const tmpBrandDir = join(tmpDir, 'public', 'brand');

    const expectedHashes = hashDir(tmpBrandDir);
    const actualHashes = hashDir(brandDir);
    const drifted = diffDirHashes(expectedHashes, actualHashes);

    return { clean: drifted.length === 0, drifted };
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}
