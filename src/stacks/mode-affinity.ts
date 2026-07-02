// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import type { InteractivityMode } from '../interactivity/mode.js';
import type { StackName } from './types.js';
import { viteRuntime } from './vite.js';
import { nextRuntime } from './next.js';
import { astroRuntime } from './astro.js';

const STACK_DEFAULT_MODES: Record<StackName, InteractivityMode> = {
  vite: viteRuntime.defaultMode(),
  next: nextRuntime.defaultMode(),
  astro: astroRuntime.defaultMode(),
};

export function deriveTargetMode(
  currentMode: InteractivityMode,
  fromStack: StackName,
  toStack: StackName,
): InteractivityMode {
  if (fromStack === toStack) return currentMode;
  if (currentMode === STACK_DEFAULT_MODES[fromStack]) return STACK_DEFAULT_MODES[toStack];
  return currentMode;
}
