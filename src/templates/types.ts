// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import type React from 'react';
import type { VbrandType } from '../schema.js';
import type { CompositionSpec } from '../composition/spec.js';
import type { ContentOverrideMap } from '../content/override.js';

export type { ContentOverrideMap };

export interface AppTypeTemplate {
  templateId(): string;
  defaultComposition(): CompositionSpec;
  compose(
    brand: VbrandType,
    composition: CompositionSpec,
    content?: ContentOverrideMap,
  ): React.ReactNode;
}
