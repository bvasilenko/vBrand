// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import React from 'react';
import { CMS_SUBSTRATE_REGISTRY } from '@booga/vbrand/cms';
import type { CmsName } from './router';

interface CmsToggleProps {
  cms: CmsName;
  onChange: (cms: CmsName) => void;
}

const CMS_COPY: Record<CmsName, { label: string; source: string; contract: string }> = {
  'vbrand-standalone': {
    label: 'vBrand',
    source: 'canonical vBrand schema',
    contract: 'schema as content',
  },
  payload: {
    label: 'Payload',
    source: 'fixture-mocked Payload pages response',
    contract: 'collections normalizer',
  },
  sanity: {
    label: 'Sanity',
    source: 'fixture-mocked Sanity GROQ response',
    contract: 'GROQ normalizer',
  },
  strapi: {
    label: 'Strapi',
    source: 'fixture-mocked Strapi populated pages response',
    contract: 'content-type normalizer',
  },
};

const CMS_ACCENT = '#22c55e';
const CMS_HOVER_BG = 'rgba(34,197,94,0.06)';

const panelStyle: React.CSSProperties = {
  border: '1px solid var(--color-neutral-200, #e5e7eb)',
  borderLeft: `4px solid ${CMS_ACCENT}`,
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

function focusRing(e: React.FocusEvent<HTMLButtonElement>) {
  e.currentTarget.style.outline = `2px solid ${CMS_ACCENT}`;
  e.currentTarget.style.outlineOffset = '1px';
}

function clearFocusRing(e: React.FocusEvent<HTMLButtonElement>) {
  e.currentTarget.style.outline = '';
  e.currentTarget.style.outlineOffset = '';
}

function cmsButtonStyle(active: boolean): React.CSSProperties {
  return {
    flex: '1 1 110px',
    minWidth: '110px',
    padding: '8px',
    border: active ? `1px solid ${CMS_ACCENT}` : '1px solid var(--color-neutral-200, #e5e7eb)',
    borderLeft: active ? `4px solid ${CMS_ACCENT}` : '4px solid transparent',
    borderRadius: '4px',
    background: active ? '#f0fdf4' : 'transparent',
    color: active ? CMS_ACCENT : 'var(--color-neutral-700, #374151)',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background 0.12s ease, border-color 0.12s ease, color 0.12s ease',
  };
}

export function CmsToggle({ cms, onChange }: CmsToggleProps) {
  return (
    <aside style={panelStyle} aria-label="CMS substrate axis">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'baseline', marginBottom: '8px' }}>
        <h2 style={{ ...eyebrowStyle, margin: 0 }}>CMS substrate</h2>
        <span style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: CMS_ACCENT }}>content-tree</span>
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {(Object.keys(CMS_SUBSTRATE_REGISTRY) as CmsName[]).map((name) => {
          const active = cms === name;
          const copy = CMS_COPY[name];
          return (
            <button
              key={name}
              type="button"
              onClick={() => onChange(name)}
              aria-pressed={active}
              style={cmsButtonStyle(active)}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = CMS_HOVER_BG; }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
              onMouseDown={(e) => { e.currentTarget.style.background = active ? '#f0fdf4' : CMS_HOVER_BG; }}
              onMouseUp={(e) => { e.currentTarget.style.background = active ? '#f0fdf4' : CMS_HOVER_BG; }}
              onFocus={focusRing}
              onBlur={clearFocusRing}
            >
              <span style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{copy.label}</span>
              <span style={{ display: 'block', marginTop: '4px', fontSize: '0.75rem', color: active ? 'var(--color-neutral-700, #374151)' : 'var(--color-neutral-500, #6b7280)' }}>{copy.contract}</span>
              <span style={{ display: 'block', marginTop: '4px', fontFamily: 'monospace', fontSize: '0.6875rem', fontWeight: active ? 700 : 400, color: active ? CMS_ACCENT : 'var(--color-neutral-400, #9ca3af)' }}>{name}</span>
            </button>
          );
        })}
      </div>
      <div style={{ margin: '8px 0 0', borderTop: '1px solid var(--color-neutral-200, #e5e7eb)', paddingTop: '8px' }}>
        <div style={{ marginBottom: '4px', fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: CMS_ACCENT }}>content-tree parity</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 8px', alignItems: 'baseline' }}>
          <span style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-neutral-400, #9ca3af)' }}>source</span>
          <code style={{ fontFamily: 'monospace', fontSize: '0.6875rem', color: 'var(--color-neutral-700, #374151)', lineHeight: 1.4 }}>{CMS_COPY[cms].source}</code>
          <span style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-neutral-400, #9ca3af)' }}>normalizer</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-neutral-500, #6b7280)' }}>{CMS_COPY[cms].contract}</span>
        </div>
      </div>
    </aside>
  );
}
