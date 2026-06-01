// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { type FuseStrategy, UMBRELLA_WINS_STRATEGY } from '../fuse/strategies.js';

export function insertAtLowestPrecedence<T>(
  candidatePartials: T[],
  baseline: T,
  strategy: FuseStrategy,
): T[] {
  if (strategy === UMBRELLA_WINS_STRATEGY) {
    return [...candidatePartials, baseline];
  }
  return [baseline, ...candidatePartials];
}
