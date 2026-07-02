// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import type { Buffer } from 'node:buffer';
import type { CompositionSpec } from '../composition/spec.js';
import type { ContentTree } from '../cms/types.js';
import type { DeployTargetName } from './types.js';

export interface DeployBundleFile {
  readonly path: string;
  readonly contents: string | Buffer;
}

export interface DeployBundle {
  readonly files: readonly DeployBundleFile[];
  readonly manifest: {
    readonly primaryEntry: string;
    readonly assetHashes: Readonly<Record<string, string>>;
  };
}

export interface DeployResult {
  readonly url: string;
  readonly logs: readonly string[];
  readonly status: 'ok' | 'failed';
  readonly durationMs: number;
}

export interface DeploymentTargetAdapter {
  name(): DeployTargetName;
  emitArtifact(composition: CompositionSpec, content: ContentTree): Promise<DeployBundle>;
  deployBundle(bundle: DeployBundle): Promise<DeployResult>;
}
