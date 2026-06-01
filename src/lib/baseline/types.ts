// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import type { VbrandType } from '../../schema.js';
import type { FuseStrategy } from '../fuse/strategies.js';

export type BaselinePartial = Required<
  Pick<VbrandType, 'name' | 'voice' | 'assets' | 'tokens'>
>;

export interface BaselineInserter {
  insertAtLowestPrecedence<T>(
    candidatePartials: T[],
    baseline: T,
    strategy: FuseStrategy,
  ): T[];
}
