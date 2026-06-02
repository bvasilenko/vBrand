// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import React from 'react';
import type { Density } from './spec.js';
import { DensitySchema } from './spec.js';

export interface DensityChipsProps {
  sectionId: string;
  active: Density;
  onSelect: (sectionId: string, density: Density) => void;
}

const ALL_DENSITIES = DensitySchema.options;

function chipStyle(isActive: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: '2px 0',
    fontSize: '0.6875rem',
    borderRadius: '4px',
    border: `1px solid ${isActive ? 'var(--color-neutral-700, #374151)' : 'var(--color-neutral-200, #e5e7eb)'}`,
    background: isActive ? 'var(--color-neutral-700, #374151)' : 'transparent',
    color: isActive ? '#ffffff' : 'var(--color-neutral-500, #6b7280)',
    cursor: 'pointer',
    transition: 'all 0.1s',
  };
}

export function DensityChips({ sectionId, active, onSelect }: DensityChipsProps) {
  return (
    <div
      role="group"
      aria-label={`Density for ${sectionId}`}
      style={{ display: 'flex', gap: '4px' }}
    >
      {ALL_DENSITIES.map((density) => {
        const isActive = density === active;
        return (
          <button
            key={density}
            data-density={density}
            aria-pressed={isActive}
            onClick={() => onSelect(sectionId, density)}
            style={chipStyle(isActive)}
            onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--color-neutral-100, #f3f4f6)'; }}
            onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
          >
            {density}
          </button>
        );
      })}
    </div>
  );
}
