// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { z } from 'zod';

export const DEPLOY_TARGET_NAMES = ['gh-pages', 'fly', 'coolify', 'vercel', 'netlify', 'cloudflare-pages', 'custom-vps'] as const;
export const DeployTargetNameSchema = z.enum(DEPLOY_TARGET_NAMES);
export type DeployTargetName = z.infer<typeof DeployTargetNameSchema>;
export const DEFAULT_DEPLOY_TARGET: DeployTargetName = 'gh-pages';

export function parseDeployTarget(raw: string | null | undefined): DeployTargetName {
  const result = DeployTargetNameSchema.safeParse(raw);
  return result.success ? result.data : DEFAULT_DEPLOY_TARGET;
}
