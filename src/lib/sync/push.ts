// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { join } from 'node:path';
import { SCHEMA_FILENAME } from '../../schema.js';
import { loadSchema } from '../schema-io.js';
import { digestJson } from './digest.js';
import { signBytes } from './sign.js';
import { scrubHandles, auditPostScrub } from './scrub.js';
import { writeBundleToDir } from './bundle-io.js';
import { readSyncConfig, syncLogPath } from './config.js';
import { appendLogEntry } from './log.js';
import type { SyncPushResult, SyncHead } from './types.js';

export interface SyncPushOptions {
  cwd?: string;
  schemaPath?: string;
  outDir?: string;
  releaseNote?: string;
  privateKeyBase64: string;
}

export async function runSyncPush(opts: SyncPushOptions): Promise<SyncPushResult> {
  const cwd = opts.cwd ?? process.cwd();
  const schemaPath = opts.schemaPath ?? join(cwd, SCHEMA_FILENAME);

  const schema = loadSchema(schemaPath);
  const handles = schema.provenance?.scrubbed_handles ?? [];

  const bundleBody = (({ provenance: _p, ...rest }) => rest)(schema);

  const { scrubbed, removedPaths } = scrubHandles(bundleBody, handles);

  // AC #31: any handle leak in the public surface refuses the push. Silent
  // scrub-and-publish would be data loss; the umbrella schema author must clean
  // their source rather than ship a quietly-mangled bundle.
  if (removedPaths.length > 0) {
    const uniquePaths = [...new Set(removedPaths)];
    throw new Error(
      `E_HANDLE_LEAK: schema contains forbidden handle references at: ${uniquePaths.join(', ')}. ` +
        `Refusing to push. Remove these values from your schema or update provenance.scrubbed_handles.`,
    );
  }

  // Belt-and-suspenders: re-scan the scrubbed bundle in case scrubHandles missed
  // a non-string carrier (object keys, array entries with unusual shapes).
  const auditOutcome = auditPostScrub(scrubbed, handles);
  if (!auditOutcome.ok) {
    const pointers = auditOutcome.findings.map((f) => f.jsonPointer).join(', ');
    throw new Error(
      `E_HANDLE_LEAK_DOWNSTREAM: scrubbed bundle still contains forbidden handles at: ${pointers}. ` +
        `Refusing to push.`,
    );
  }

  const config = readSyncConfig(cwd);
  const outDir = opts.outDir ?? config.distributionDir;
  if (!outDir) {
    throw new Error(
      `No output directory configured. Set distributionDir in sync.config.json or pass --out-dir.`,
    );
  }

  const digest = digestJson(scrubbed);

  const head: SyncHead = {
    digest,
    publishedAt: new Date().toISOString(),
    publicKey: config.publicKeyBase64,
    ...(opts.releaseNote !== undefined ? { releaseNote: opts.releaseNote } : {}),
  };

  const headBytes = Buffer.from(JSON.stringify(head, null, 2) + '\n', 'utf-8');
  const headSigBase64 = signBytes(headBytes, opts.privateKeyBase64);
  const bundleJson = JSON.stringify(scrubbed, null, 2) + '\n';

  const written = writeBundleToDir(outDir, head, headSigBase64, bundleJson);
  const files = [written.headPath, written.headSigPath, written.bundlePath];

  appendLogEntry(syncLogPath(cwd), {
    at: new Date().toISOString(),
    op: 'push',
    digest,
    ...(removedPaths.length > 0 ? { fieldsHeld: removedPaths } : {}),
    ...(opts.releaseNote !== undefined ? { releaseNote: opts.releaseNote } : {}),
  });

  return { digest, files };
}
