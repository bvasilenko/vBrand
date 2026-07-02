// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import React from 'react';
import { DEPLOY_TARGET_METADATA } from '@booga/vbrand/deploy/metadata';

const DEPLOY_ACCENT = '#eab308';

const panelStyle: React.CSSProperties = {
  border: '1px solid var(--color-neutral-200, #e5e7eb)',
  borderLeft: `4px solid ${DEPLOY_ACCENT}`,
  borderRadius: '4px',
  padding: '12px',
  background: 'var(--color-neutral-50, #f9fafb)',
  fontFamily: 'system-ui, sans-serif',
};

const eyebrowStyle: React.CSSProperties = {
  margin: '0 0 8px',
  fontSize: '0.6875rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--color-neutral-400, #9ca3af)',
};

export function DeployInfo() {
  return (
    <aside
      style={panelStyle}
      aria-label="Deployment target contract"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'baseline', marginBottom: '8px' }}>
        <h2 style={{ ...eyebrowStyle, margin: 0 }}>Deploy target</h2>
        <span style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: DEPLOY_ACCENT }}>deploy manifest</span>
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: '8px' }}>
        {DEPLOY_TARGET_METADATA.map((target) => {
          const wired = target.status === 'wired';
          return (
            <li key={target.name} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center', gap: '8px', border: '1px solid var(--color-neutral-200, #e5e7eb)', borderLeft: wired ? '4px solid #22c55e' : '4px solid #f97316', borderRadius: '4px', background: wired ? '#f0fdf4' : '#fff7ed', padding: '8px 12px', fontVariantNumeric: 'tabular-nums' }}>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-neutral-700, #374151)' }}>{target.label}</span>
                <code style={{ display: 'block', marginTop: '2px', fontFamily: 'monospace', fontSize: '0.6875rem', color: 'var(--color-neutral-500, #6b7280)' }}>{target.name}</code>
              </span>
              <strong style={{ flexShrink: 0, whiteSpace: 'nowrap', textAlign: 'right', fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: wired ? '#22c55e' : '#f97316' }}>{target.badge}</strong>
            </li>
          );
        })}
      </ul>
      <div style={{ marginTop: '8px', borderTop: '1px solid var(--color-neutral-200, #e5e7eb)', paddingTop: '8px' }}>
        <div style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#22c55e' }}>gh-pages live surface</div>
        <a
          href="https://bvasilenko.github.io/vBrand/"
          style={{ display: 'block', marginTop: '4px', border: '1px solid var(--color-neutral-200, #e5e7eb)', borderRadius: '4px', padding: '4px 8px', background: 'rgba(99,102,241,0.06)', fontFamily: 'monospace', fontSize: '0.75rem', lineHeight: 1.4, color: 'var(--color-primary, #6366f1)', wordBreak: 'break-all', transition: 'border-color 0.12s ease, background 0.12s ease' }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary, #6366f1)'; e.currentTarget.style.background = 'rgba(99,102,241,0.12)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-neutral-200, #e5e7eb)'; e.currentTarget.style.background = 'rgba(99,102,241,0.06)'; }}
          onFocus={(e) => { e.currentTarget.style.outline = '2px solid var(--color-primary, #6366f1)'; e.currentTarget.style.outlineOffset = '1px'; }}
          onBlur={(e) => { e.currentTarget.style.outline = ''; e.currentTarget.style.outlineOffset = ''; }}
        >https://bvasilenko.github.io/vBrand/</a>
      </div>
    </aside>
  );
}
