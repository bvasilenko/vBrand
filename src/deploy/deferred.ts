// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import type { CompositionSpec } from '../composition/spec.js';
import type { ContentTree } from '../cms/types.js';
import type { DeploymentTargetAdapter, DeployBundle, DeployResult } from './contract.js';
import type { DeployTargetName } from './types.js';

export const DECOUPLED_FOR_LATER_MESSAGE = 'DECOUPLED-FOR-LATER: vBrand 0.5.0 multi-deploy-target emit';

const DEFERRED_BUNDLE: DeployBundle = Object.freeze({
  files: Object.freeze([
    { path: 'index.html',     contents: `<!doctype html><html><body>${DECOUPLED_FOR_LATER_MESSAGE}</body></html>` },
    { path: '404.html',       contents: `<!doctype html><html><body>${DECOUPLED_FOR_LATER_MESSAGE}</body></html>` },
    { path: 'assets/.keep',   contents: '' },
    { path: 'data/.keep',     contents: '' },
  ]),
  manifest: Object.freeze({ primaryEntry: 'index.html', assetHashes: Object.freeze({}) }),
});

export function createDeferredTarget(name: DeployTargetName): DeploymentTargetAdapter {
  return {
    name: () => name,
    emitArtifact(_composition: CompositionSpec, _content: ContentTree): Promise<DeployBundle> {
      return Promise.resolve(DEFERRED_BUNDLE);
    },
    async deployBundle(): Promise<DeployResult> {
      throw new Error(DECOUPLED_FOR_LATER_MESSAGE);
    },
  };
}
