// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import type React from 'react';
import type { InteractivityMode } from '../interactivity/mode.js';
import type { StackName } from './types.js';
import { DEFAULT_STACK } from './types.js';
import { viteRuntime } from './vite.js';
import { nextRuntime } from './next.js';
import { astroRuntime } from './astro.js';

export type { StackName } from './types.js';
export { DEFAULT_STACK, parseStack, StackNameSchema, STACK_NAMES } from './types.js';

export interface StackRuntime {
  name(): StackName;
  bootstrapMarkup(composed: React.ReactNode): string;
  defaultMode(): InteractivityMode;
}

export const STACK_RUNTIME_REGISTRY: Record<StackName, StackRuntime> = {
  vite: viteRuntime,
  next: nextRuntime,
  astro: astroRuntime,
};

export function getStackRuntime(name: StackName): StackRuntime {
  return STACK_RUNTIME_REGISTRY[name] ?? STACK_RUNTIME_REGISTRY[DEFAULT_STACK];
}

export { viteRuntime } from './vite.js';
export { nextRuntime } from './next.js';
export { astroRuntime } from './astro.js';
export { deriveTargetMode } from './mode-affinity.js';
