// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import type { DeployTargetName } from './types.js';
import { DEFAULT_DEPLOY_TARGET, DEPLOY_TARGET_NAMES, DeployTargetNameSchema, parseDeployTarget } from './types.js';

export type DeployTargetStatus = 'wired' | 'decoupled-for-later';

export interface DeployTargetMetadata {
  readonly name: DeployTargetName;
  readonly label: string;
  readonly status: DeployTargetStatus;
  readonly badge: 'index.html' | 'DECOUPLED-FOR-LATER';
}

const DEPLOY_TARGET_LABELS: Record<DeployTargetName, string> = {
  'gh-pages': 'GitHub Pages',
  fly: 'Fly',
  coolify: 'Coolify',
  vercel: 'Vercel',
  netlify: 'Netlify',
  'cloudflare-pages': 'Cloudflare Pages',
  'custom-vps': 'Custom VPS',
};

function metadataFor(name: DeployTargetName): DeployTargetMetadata {
  const wired = name === DEFAULT_DEPLOY_TARGET;
  return {
    name,
    label: DEPLOY_TARGET_LABELS[name],
    status: wired ? 'wired' : 'decoupled-for-later',
    badge: wired ? 'index.html' : 'DECOUPLED-FOR-LATER',
  };
}

export const DEPLOY_TARGET_METADATA: readonly DeployTargetMetadata[] = DEPLOY_TARGET_NAMES.map(metadataFor);

export function getDeployTargetMetadata(name: DeployTargetName): DeployTargetMetadata {
  return DEPLOY_TARGET_METADATA.find((target) => target.name === name) ?? metadataFor(DEFAULT_DEPLOY_TARGET);
}

export { DEFAULT_DEPLOY_TARGET, DEPLOY_TARGET_NAMES, DeployTargetNameSchema, parseDeployTarget };
export type { DeployTargetName };
