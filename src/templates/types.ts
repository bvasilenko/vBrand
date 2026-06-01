// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import type React from 'react';
import type { VbrandType } from '../schema.js';
import type { CompositionSpec } from '../composition/spec.js';

export type ContentOverrideMap = Record<string, unknown>;

export interface AppTypeTemplate {
  templateId(): string;
  defaultComposition(): CompositionSpec;
  compose(
    brand: VbrandType,
    composition: CompositionSpec,
    content?: ContentOverrideMap,
  ): React.ReactNode;
}
