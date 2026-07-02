// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import React from 'react';
import { STACK_RUNTIME_REGISTRY } from '@booga/vbrand/stacks';
import type { StackName } from './router';

interface StackToggleProps {
  stack: StackName;
  onChange: (stack: StackName) => void;
}

const STACK_COPY: Record<StackName, { label: string; shape: string; marker: string }> = {
  vite: {
    label: 'Vite',
    shape: 'SPA bootstrap preview',
    marker: 'representative SPA bootstrap boundary, not full hydration',
  },
  next: {
    label: 'Next',
    shape: 'Hybrid preview',
    marker: 'page data plus client boundary metadata',
  },
  astro: {
    label: 'Astro',
    shape: 'Static preview',
    marker: 'explicit island hydration markers',
  },
};

const MODE_COLOR: Record<string, string> = {
  static: '#22c55e',
  hybrid: '#eab308',
  spa: 'var(--color-primary, #6366f1)',
};

const STACK_ACCENT: Record<StackName, string> = {
  vite: 'var(--color-primary, #6366f1)',
  next: '#eab308',
  astro: '#22c55e',
};

const STACK_PANEL_BG = 'var(--color-neutral-50, #f9fafb)';

const STACK_HOVER_BG: Record<StackName, string> = {
  vite: 'rgba(99,102,241,0.06)',
  next: 'rgba(234,179,8,0.06)',
  astro: 'rgba(34,197,94,0.06)',
};

const STACK_ACTIVE_BG: Record<StackName, string> = {
  vite: 'rgba(99,102,241,0.08)',
  next: '#fefce8',
  astro: '#f0fdf4',
};

const panelStyle: React.CSSProperties = {
  border: '1px solid var(--color-neutral-200, #e5e7eb)',
  borderLeft: '4px solid var(--color-primary, #6366f1)',
  borderRadius: '4px',
  padding: '12px',
  background: STACK_PANEL_BG,
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

function focusRing(e: React.FocusEvent<HTMLButtonElement>, color: string) {
  e.currentTarget.style.outline = `2px solid ${color}`;
  e.currentTarget.style.outlineOffset = '1px';
}

function clearFocusRing(e: React.FocusEvent<HTMLButtonElement>) {
  e.currentTarget.style.outline = '';
  e.currentTarget.style.outlineOffset = '';
}

function stackButtonStyle(name: StackName, active: boolean): React.CSSProperties {
  const accent = STACK_ACCENT[name];
  return {
    flex: '1 1 72px',
    minWidth: '72px',
    padding: '8px',
    border: active ? `1px solid ${accent}` : '1px solid var(--color-neutral-200, #e5e7eb)',
    borderLeft: active ? `4px solid ${accent}` : '4px solid transparent',
    borderRadius: '4px',
    background: active ? STACK_ACTIVE_BG[name] : 'transparent',
    color: active ? accent : 'var(--color-neutral-700, #374151)',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background 0.12s ease, border-color 0.12s ease, color 0.12s ease',
  };
}

export function StackToggle({ stack, onChange }: StackToggleProps) {
  const activeMode = STACK_RUNTIME_REGISTRY[stack].defaultMode();
  const activeAccent = STACK_ACCENT[stack];

  return (
    <aside style={{ ...panelStyle, borderLeft: `4px solid ${activeAccent}` }} aria-label="Stack runtime axis">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'baseline', marginBottom: '8px' }}>
        <h2 style={{ ...eyebrowStyle, margin: 0 }}>Stack runtime</h2>
        <span style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: MODE_COLOR[activeMode] }}>default {activeMode}</span>
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {(Object.keys(STACK_RUNTIME_REGISTRY) as StackName[]).map((name) => {
          const active = stack === name;
          const copy = STACK_COPY[name];
          return (
            <button
              key={name}
              type="button"
              onClick={() => onChange(name)}
              aria-pressed={active}
              style={stackButtonStyle(name, active)}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = STACK_HOVER_BG[name]; }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
              onMouseDown={(e) => { e.currentTarget.style.background = active ? STACK_ACTIVE_BG[name] : STACK_HOVER_BG[name]; e.currentTarget.style.borderColor = STACK_ACCENT[name]; }}
              onMouseUp={(e) => { e.currentTarget.style.background = active ? STACK_ACTIVE_BG[name] : STACK_HOVER_BG[name]; e.currentTarget.style.borderColor = active ? STACK_ACCENT[name] : 'var(--color-neutral-200, #e5e7eb)'; }}
              onFocus={(e) => focusRing(e, STACK_ACCENT[name])}
              onBlur={clearFocusRing}
            >
              <span style={{ display: 'flex', justifyContent: 'space-between', gap: '4px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{copy.label}</span>
                <span aria-hidden="true" style={{ width: '6px', height: '6px', borderRadius: '999px', background: STACK_ACCENT[name], flexShrink: 0 }} />
              </span>
              <span style={{ display: 'block', marginTop: '4px', fontSize: '0.75rem', color: active ? 'var(--color-neutral-700, #374151)' : 'var(--color-neutral-500, #6b7280)' }}>{copy.shape}</span>
            </button>
          );
        })}
      </div>
      <div style={{ marginTop: '8px', borderTop: '1px solid var(--color-neutral-200, #e5e7eb)', paddingTop: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'baseline' }}>
          <code style={{ fontSize: '0.75rem', color: activeAccent, fontFamily: 'monospace', fontWeight: 700 }}>{stack}</code>
          <strong style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: MODE_COLOR[activeMode] }}>{activeMode}</strong>
        </div>
        <div style={{ marginTop: '4px', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 8px', alignItems: 'baseline' }}>
          <span style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-neutral-400, #9ca3af)' }}>artefact</span>
          <code style={{ fontFamily: 'monospace', fontSize: '0.6875rem', color: 'var(--color-neutral-700, #374151)' }}>dist/stacks/{stack}.html</code>
          <span style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-neutral-400, #9ca3af)' }}>marker</span>
          <span style={{ fontSize: '0.75rem', lineHeight: 1.4, color: 'var(--color-neutral-500, #6b7280)' }}>{STACK_COPY[stack].marker}</span>
        </div>
      </div>
    </aside>
  );
}
