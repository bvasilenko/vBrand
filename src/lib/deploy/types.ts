// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko

export type DeployTarget = 'compose-ssh' | 'coolify' | 'caprover' | 'fly' | 'none';

export interface DeployManifest {
  registry: {
    kind: 'ghcr' | 'gitlab' | 'dockerhub' | 'custom';
    imageName: string;
  };
  deploy: {
    kind: DeployTarget;
    host?: string | null;
    appUuid?: string | null;
    webhookSecret?: string | null;
    tokenSecret?: string | null;
    sshSecret?: string | null;
  };
  build: {
    runtime: 'nginx' | 'bun';
    context: string;
    platforms: string[];
  };
}

export interface PrepareInput {
  imageRef: string;
  host: string;
  authEnvVar: string;
}

export interface DeployHistoryEntry {
  at: string;
  target: DeployTarget;
  imageRef: string;
  digest?: string;
  host: string;
  status: 'started' | 'success' | 'failed' | 'rolled-back';
  reason?: string;
}

export interface DeployAdapter {
  readonly name: DeployTarget;
  prepare(input: PrepareInput): Promise<{ contextName: string; composePath?: string }>;
  trigger(input: {
    imageRef: string;
    contextName: string;
    composePath?: string;
  }): Promise<{ digest?: string }>;
  health(input: {
    contextName: string;
    composePath?: string;
    url?: string;
    timeoutMs: number;
  }): Promise<{ ok: boolean; details?: string }>;
  rollback(input: { toImageRef: string; contextName: string; composePath?: string }): Promise<void>;
}
