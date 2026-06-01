// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
export type { CompositionSpec, SectionSpec, Density } from './spec.js';
export {
  CompositionSpecSchema,
  SectionSpecSchema,
  DensitySchema,
  encodeComposition,
  decodeComposition,
  compositionFromHash,
  compositionToHash,
  sectionsByOrder,
  visibleSections,
  updateSection,
  reorderSections,
} from './spec.js';
export type { CompositionEditorProps } from './editor.js';
export { CompositionEditor } from './editor.js';
