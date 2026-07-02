// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import type { DeploymentTargetAdapter } from './contract.js';
import type { DeployTargetName } from './types.js';
import { DEFAULT_DEPLOY_TARGET } from './types.js';
import { ghPagesTarget } from './gh-pages.js';
import { flyTarget } from './fly.js';
import { coolifyTarget } from './coolify.js';
import { vercelTarget } from './vercel.js';
import { netlifyTarget } from './netlify.js';
import { cloudflarePagesTarget } from './cloudflare-pages.js';
import { customVpsTarget } from './custom-vps.js';

export type { DeploymentTargetAdapter, DeployBundle, DeployBundleFile, DeployResult } from './contract.js';
export type { DeployTargetName } from './types.js';
export { DEFAULT_DEPLOY_TARGET, DEPLOY_TARGET_NAMES, DeployTargetNameSchema, parseDeployTarget } from './types.js';
export { DEPLOY_TARGET_METADATA, getDeployTargetMetadata } from './metadata.js';
export type { DeployTargetMetadata, DeployTargetStatus } from './metadata.js';
export { DECOUPLED_FOR_LATER_MESSAGE } from './deferred.js';
export { buildStaticDeployBundle } from './bundle.js';

export const DEPLOY_TARGET_REGISTRY: Record<DeployTargetName, DeploymentTargetAdapter> = {
  'gh-pages': ghPagesTarget,
  fly: flyTarget,
  coolify: coolifyTarget,
  vercel: vercelTarget,
  netlify: netlifyTarget,
  'cloudflare-pages': cloudflarePagesTarget,
  'custom-vps': customVpsTarget,
};

export function getDeployTarget(name: DeployTargetName): DeploymentTargetAdapter {
  return DEPLOY_TARGET_REGISTRY[name] ?? DEPLOY_TARGET_REGISTRY[DEFAULT_DEPLOY_TARGET];
}

export { createGhPagesTarget, ghPagesTarget, runGhPagesCli } from './gh-pages.js';
export { flyTarget } from './fly.js';
export { coolifyTarget } from './coolify.js';
export { vercelTarget } from './vercel.js';
export { netlifyTarget } from './netlify.js';
export { cloudflarePagesTarget } from './cloudflare-pages.js';
export { customVpsTarget } from './custom-vps.js';
