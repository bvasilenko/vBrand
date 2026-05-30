// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { join } from 'node:path';
import { readSyncConfig } from './config.js';
import { readOverrides, OVERRIDES_FILENAME, activeOverrideCount } from './overrides.js';
import { fetchHead, fetchHeadSig, fetchBundleByDigest } from './bundle-io.js';
import { verifyBytes } from './sign.js';
import { scanForHandleLeaks } from './handle-audit.js';
import { VbrandSchema } from '../../schema.js';
import { digestJson } from './digest.js';
import type { SyncStatus, SyncVerifyResult } from './types.js';

export interface SyncStatusOptions {
  cwd?: string;
  overridesPath?: string;
}

export async function computeSyncStatus(opts: SyncStatusOptions = {}): Promise<SyncStatus> {
  const cwd = opts.cwd ?? process.cwd();
  const overridesPath = opts.overridesPath ?? join(cwd, OVERRIDES_FILENAME);

  const config = readSyncConfig(cwd);

  let remoteDigest: string | undefined;
  try {
    const { head } = await fetchHead(config.umbrellaUrl);
    remoteDigest = head.digest;
  } catch {
    remoteDigest = undefined;
  }

  const behind =
    remoteDigest !== undefined && remoteDigest !== config.lastDigest;

  const overridesDoc = readOverrides(overridesPath);
  const ahead = overridesDoc !== null && activeOverrideCount(overridesDoc) > 0;
  const heldFields =
    overridesDoc !== null
      ? Object.entries(overridesDoc.overrides)
          .filter(([, e]) => !e.superseded)
          .map(([path]) => path)
      : [];

  const code = behind && ahead ? 3 : behind ? 1 : ahead ? 2 : 0;

  return {
    code: code as SyncStatus['code'],
    behind,
    ahead,
    heldFields,
    localDigest: config.lastDigest,
    remoteDigest,
  };
}

export interface SyncVerifyOptions {
  cwd?: string;
}

export async function runSyncVerify(opts: SyncVerifyOptions = {}): Promise<SyncVerifyResult> {
  const cwd = opts.cwd ?? process.cwd();
  const config = readSyncConfig(cwd);

  if (!config.lastDigest) {
    throw new Error(`Nothing to verify. Run: vbrand sync pull`);
  }

  const { head, headBytes } = await fetchHead(config.umbrellaUrl);
  const headSigBase64 = await fetchHeadSig(config.umbrellaUrl);
  const signatureOk = verifyBytes(headBytes, headSigBase64, config.publicKeyBase64);

  const { bundle, bundleBytes } = await fetchBundleByDigest(
    config.umbrellaUrl,
    head.digest,
  );

  const actualDigest = digestJson(JSON.parse(bundleBytes.toString('utf-8')));
  const digestOk = actualDigest === head.digest;

  const handles =
    (bundle as { provenance?: { scrubbed_handles?: string[] } }).provenance
      ?.scrubbed_handles ?? [];
  const handleLeakFindings = scanForHandleLeaks(bundle, handles);

  VbrandSchema.parse(bundle);

  return {
    valid: signatureOk && digestOk && handleLeakFindings.length === 0,
    digest: head.digest,
    signatureOk,
    handleLeakFindings,
  };
}
