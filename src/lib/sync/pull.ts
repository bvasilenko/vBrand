// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { join } from 'node:path';
import { SCHEMA_FILENAME, VbrandSchema } from '../../schema.js';
import { loadSchema, writeSchema } from '../schema-io.js';
import { mergePatch } from '../fuse/merge-patch.js';
import { fetchHead, fetchHeadSig, fetchBundleByDigest } from './bundle-io.js';
import { verifyBytes } from './sign.js';
import { digestJson } from './digest.js';
import { readSyncConfig, writeSyncConfig, patchSyncConfig, syncLogPath, defaultConflictPolicy } from './config.js';
import { readOverrides, OVERRIDES_FILENAME, applyOverrides } from './overrides.js';
import { appendLogEntry } from './log.js';
import { scanForHandleLeaks } from './handle-audit.js';
import type { SyncPullResult, ConflictPolicy } from './types.js';

export interface SyncPullOptions {
  cwd?: string;
  schemaPath?: string;
  overridesPath?: string;
  forcePolicy?: ConflictPolicy;
}

export interface SyncInitOptions {
  cwd?: string;
  umbrellaUrl: string;
  conflictPolicy?: ConflictPolicy;
  distributionDir?: string;
}

export async function runSyncInit(opts: SyncInitOptions): Promise<void> {
  const cwd = opts.cwd ?? process.cwd();

  const { head } = await fetchHead(opts.umbrellaUrl);

  writeSyncConfig(cwd, {
    umbrellaUrl: opts.umbrellaUrl,
    publicKeyBase64: head.publicKey,
    conflictPolicy: opts.conflictPolicy ?? defaultConflictPolicy(),
    ...(opts.distributionDir !== undefined
      ? { distributionDir: opts.distributionDir }
      : {}),
  });

  appendLogEntry(syncLogPath(cwd), {
    at: new Date().toISOString(),
    op: 'init',
    digest: head.digest,
  });
}

export async function runSyncPull(opts: SyncPullOptions = {}): Promise<SyncPullResult> {
  const cwd = opts.cwd ?? process.cwd();
  const schemaPath = opts.schemaPath ?? join(cwd, SCHEMA_FILENAME);
  const overridesPath = opts.overridesPath ?? join(cwd, OVERRIDES_FILENAME);

  const config = readSyncConfig(cwd);
  const policy = opts.forcePolicy ?? config.conflictPolicy;

  const { head, headBytes } = await fetchHead(config.umbrellaUrl);

  if (head.digest === config.lastDigest) {
    return {
      digest: head.digest,
      fieldsAdopted: 0,
      fieldsHeld: [],
      alreadyCurrent: true,
      observedValues: {},
    };
  }

  const headSigBase64 = await fetchHeadSig(config.umbrellaUrl);
  const sigValid = verifyBytes(headBytes, headSigBase64, config.publicKeyBase64);
  if (!sigValid) {
    throw new Error(
      `Signature verification failed for head at ${config.umbrellaUrl}. ` +
        `The bundle may have been tampered with.`,
    );
  }

  const { bundle, bundleBytes } = await fetchBundleByDigest(config.umbrellaUrl, head.digest);

  const actualDigest = digestJson(JSON.parse(bundleBytes.toString('utf-8')));
  if (actualDigest !== head.digest) {
    throw new Error(
      `Bundle digest mismatch. Expected ${head.digest}, got ${actualDigest}. ` +
        `Distribution content is inconsistent.`,
    );
  }

  const handles = (bundle as { provenance?: { scrubbed_handles?: string[] } })
    .provenance?.scrubbed_handles ?? [];
  const leaks = scanForHandleLeaks(bundle, handles);
  if (leaks.length > 0) {
    const pointers = leaks.map((l) => l.jsonPointer).join(', ');
    throw new Error(
      `E_HANDLE_LEAK_DOWNSTREAM: received bundle contains forbidden handles at: ${pointers}. ` +
        `Refusing to apply.`,
    );
  }

  const umbrellaSchema = VbrandSchema.parse(bundle);

  const localSchema = loadSchema(schemaPath);
  const mergedUnknown = mergePatch(localSchema as unknown, umbrellaSchema as unknown);
  const mergedSchema = VbrandSchema.parse(mergedUnknown);

  const overridesDoc = readOverrides(overridesPath);

  let finalSchema = mergedSchema;
  let heldFields: string[] = [];
  let observedValues: Record<string, unknown> = {};

  if (overridesDoc !== null && policy !== 'force') {
    const result = applyOverrides(mergedSchema, overridesDoc);
    finalSchema = result.schema;
    heldFields = result.heldFields;
    observedValues = result.observedValues;
  }

  writeSchema(finalSchema, schemaPath);
  patchSyncConfig(cwd, { lastDigest: head.digest });

  const fieldsAdopted = countAdoptedFields(localSchema as unknown, mergedSchema as unknown);

  appendLogEntry(syncLogPath(cwd), {
    at: new Date().toISOString(),
    op: 'pull',
    digest: head.digest,
    fieldsAdopted,
    ...(heldFields.length > 0 ? { fieldsHeld: heldFields } : {}),
    ...(Object.keys(observedValues).length > 0 ? { observedValues } : {}),
    ...(head.releaseNote !== undefined ? { releaseNote: head.releaseNote } : {}),
  });

  return {
    digest: head.digest,
    fieldsAdopted,
    fieldsHeld: heldFields,
    alreadyCurrent: false,
    observedValues,
  };
}

function countAdoptedFields(before: unknown, after: unknown): number {
  let count = 0;
  function walk(a: unknown, b: unknown): void {
    if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
      if (JSON.stringify(a) !== JSON.stringify(b)) count++;
      return;
    }
    if (Array.isArray(a) || Array.isArray(b)) {
      if (JSON.stringify(a) !== JSON.stringify(b)) count++;
      return;
    }
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const keys = new Set([...Object.keys(aObj), ...Object.keys(bObj)]);
    for (const key of keys) {
      walk(aObj[key], bObj[key]);
    }
  }
  walk(before, after);
  return count;
}
