// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import type { CSSProperties } from 'react';
import type { Breakpoint } from './use-breakpoint';

export interface LayoutAreas {
  readonly outer: CSSProperties;
  readonly composition: CSSProperties;
  readonly preview: CSSProperties;
  readonly operations: CSSProperties;
}

const BASE_OUTER: CSSProperties = {
  gap: '12px',
  padding: '12px',
  fontFamily: 'system-ui, sans-serif',
};

const WIDE: LayoutAreas = {
  outer: {
    ...BASE_OUTER,
    display: 'grid',
    gridTemplateColumns: '280px minmax(0, 1fr) 320px',
    gridTemplateAreas: '"composition preview operations"',
    flex: 1,
    minHeight: 0,
  },
  composition: { gridArea: 'composition', minWidth: 0 },
  preview:     { gridArea: 'preview', minWidth: 0, display: 'flex' },
  operations:  { gridArea: 'operations', display: 'grid', gap: '12px', overflow: 'auto', alignContent: 'start' },
};

const MID: LayoutAreas = {
  outer: {
    ...BASE_OUTER,
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gridTemplateRows: 'minmax(0, 1fr) auto',
    gridTemplateAreas: '"preview preview" "composition operations"',
    flex: 1,
    minHeight: 0,
  },
  composition: { gridArea: 'composition', minWidth: 0, overflow: 'auto' },
  preview:     { gridArea: 'preview', minWidth: 0, display: 'flex' },
  operations:  { gridArea: 'operations', minWidth: 0, display: 'grid', gap: '12px', overflow: 'auto', alignContent: 'start' },
};

const NARROW: LayoutAreas = {
  outer: {
    ...BASE_OUTER,
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    overflowY: 'auto',
  },
  composition: { minWidth: 0 },
  preview:     { minWidth: 0, display: 'flex', height: '300px', flexShrink: 0 },
  operations:  { minWidth: 0, display: 'grid', gap: '12px' },
};

const LAYOUT_MAP: Record<Breakpoint, LayoutAreas> = {
  wide:   WIDE,
  mid:    MID,
  narrow: NARROW,
};

export function deriveLayout(breakpoint: Breakpoint): LayoutAreas {
  return LAYOUT_MAP[breakpoint];
}
