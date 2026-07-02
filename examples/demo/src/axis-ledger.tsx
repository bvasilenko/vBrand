// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import React from 'react';
import type { StackName, CmsName } from './router';

export interface AxisLedgerProps {
  stack: StackName;
  cms: CmsName;
}

const LEDGER_AXES: ReadonlyArray<{ label: string; color: string; getValue: (p: AxisLedgerProps) => string }> = [
  { label: 'Stack',  color: 'var(--color-primary, #6366f1)', getValue: (p) => p.stack },
  { label: 'CMS',    color: '#22c55e',                        getValue: (p) => p.cms  },
  { label: 'Deploy', color: '#eab308',                        getValue: ()  => 'gh-pages' },
];

const LEDGER_SURFACE_STYLE: React.CSSProperties = {
  border: '1px solid var(--color-neutral-200, #e5e7eb)',
  borderLeft: '4px solid var(--color-primary, #6366f1)',
  borderRadius: '4px',
  padding: '12px',
  background: 'var(--color-neutral-50, #f9fafb)',
  fontFamily: 'system-ui, sans-serif',
};

export function AxisLedger({ stack, cms }: AxisLedgerProps) {
  return (
    <div style={LEDGER_SURFACE_STYLE}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'baseline' }}>
        <div style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-neutral-400, #9ca3af)' }}>
          axis ledger
        </div>
        <span style={{
          background: 'var(--color-primary, #6366f1)',
          color: '#fff',
          borderRadius: '4px',
          padding: '2px 8px',
          fontSize: '0.6875rem',
          fontWeight: 700,
          letterSpacing: '0.08em',
          fontFamily: 'system-ui, sans-serif',
          fontVariantNumeric: 'tabular-nums',
        }}>7/9 flexed</span>
      </div>
      <div style={{ marginTop: '8px', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 8px', fontSize: '0.75rem', color: 'var(--color-neutral-500, #6b7280)', fontVariantNumeric: 'tabular-nums' }}>
        {LEDGER_AXES.map(({ label, color, getValue }) => (
          <React.Fragment key={label}>
            <strong style={{ color, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.6875rem' }}>{label}</strong>
            <code style={{ fontFamily: 'monospace', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-neutral-700, #374151)' }}>{getValue({ stack, cms })}</code>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
