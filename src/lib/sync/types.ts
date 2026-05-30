// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko

export type ConflictPolicy = 'respect' | 'force' | 'warn';

export interface SyncConfig {
  umbrellaUrl: string;
  publicKeyBase64: string;
  conflictPolicy: ConflictPolicy;
  lastDigest?: string;
  distributionDir?: string;
}

export interface SyncHead {
  digest: string;
  publishedAt: string;
  publicKey: string;
  releaseNote?: string;
}

export interface OverrideEntry {
  value: unknown;
  reason?: string;
  setAt: string;
  setBy?: string;
  superseded?: true;
}

export interface OverridesDoc {
  $overrides: true;
  umbrella: string;
  baseDigest: string;
  overrides: Record<string, OverrideEntry>;
}

export type SyncLogOp = 'init' | 'pull' | 'push' | 'verify' | 'override' | 'forget';

export interface SyncLogEntry {
  at: string;
  op: SyncLogOp;
  digest: string;
  fieldsAdopted?: number;
  fieldsHeld?: string[];
  observedValues?: Record<string, unknown>;
  releaseNote?: string;
  error?: string;
}

export type SyncStatusCode = 0 | 1 | 2 | 3;

export interface SyncStatus {
  code: SyncStatusCode;
  behind: boolean;
  ahead: boolean;
  heldFields: string[];
  localDigest: string | undefined;
  remoteDigest: string | undefined;
}

export interface SyncPushResult {
  digest: string;
  files: string[];
}

export interface SyncPullResult {
  digest: string;
  fieldsAdopted: number;
  fieldsHeld: string[];
  alreadyCurrent: boolean;
  observedValues: Record<string, unknown>;
}

export interface SyncVerifyResult {
  valid: boolean;
  digest: string;
  signatureOk: boolean;
  handleLeakFindings: HandleLeakFinding[];
}

export interface HandleLeakFinding {
  jsonPointer: string;
  value: string;
  handle: string;
}
