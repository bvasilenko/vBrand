// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import React, { useState } from 'react';
import type { TemplateId, InteractivityMode } from './router';
import { buildSearchString, DEFAULT_MODE } from './router';

interface NavBarProps {
  currentBrand: string;
  currentTemplate: TemplateId;
  currentMode?: InteractivityMode;
  isLoading: boolean;
  dataViewHref: string;
  onDataViewNavigate: () => void;
}

const TEMPLATE_IDS: readonly TemplateId[] = ['landing', 'marketing', 'docs', 'dashboard'];
const INTERACTION_MODES: readonly InteractivityMode[] = ['static', 'hybrid', 'spa'];

const BRAND_EXAMPLES: Array<{ label: string; value: string }> = [
  { label: 'Stripe (fixture)', value: 'fixture:stripe' },
  { label: 'Vercel (fixture)', value: 'fixture:vercel' },
  { label: 'Linear (fixture)', value: 'fixture:linear' },
  { label: 'Notion (fixture)', value: 'fixture:notion' },
  { label: 'GitHub (fixture)', value: 'fixture:github' },
  { label: 'GitHub repo', value: 'github:bvasilenko/vBrand' },
  { label: 'npm package', value: 'npm:@booga/vbrand' },
];

export function NavBar({ currentBrand, currentTemplate, currentMode, isLoading, dataViewHref, onDataViewNavigate }: NavBarProps) {
  const [brandInput, setBrandInput] = useState(currentBrand);
  const activeMode = currentMode ?? DEFAULT_MODE;

  function applySearch(brand: string, template: TemplateId, mode: InteractivityMode) {
    const search = buildSearchString(brand, template, mode);
    if (template !== currentTemplate) {
      window.location.href = `${window.location.pathname}?${search}`;
    } else {
      window.location.search = search;
    }
  }

  function handleBrandLoad() {
    applySearch(brandInput, currentTemplate, activeMode);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleBrandLoad();
  }

  function loadExample(value: string) {
    setBrandInput(value);
  }

  function handleDataViewClick(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    onDataViewNavigate();
  }

  return (
    <nav
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 20px',
        borderBottom: '1px solid var(--color-neutral-200, #e5e7eb)',
        background: 'var(--color-neutral-50, #f9fafb)',
        flexWrap: 'wrap',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '0.8125rem',
      }}
    >
      <span style={{ fontWeight: 700, color: 'var(--color-primary, #6366f1)', flexShrink: 0 }}>
        vBrand 0.4.0-alpha.4
      </span>

      <span style={{ color: 'var(--color-neutral-400, #9ca3af)', flexShrink: 0 }}>brand:</span>
      <input
        value={brandInput}
        onChange={(e) => setBrandInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="fixture:stripe | github:owner/repo | npm:pkg | https://..."
        style={{
          flex: '1 1 300px',
          padding: '6px 10px',
          border: '1px solid var(--color-neutral-200, #e5e7eb)',
          borderRadius: '4px',
          fontSize: '0.8125rem',
          fontFamily: 'monospace',
          minWidth: 0,
        }}
      />

      <select
        value={currentTemplate}
        onChange={(e) => applySearch(brandInput, e.target.value as TemplateId, activeMode)}
        style={{
          padding: '6px 10px',
          border: '1px solid var(--color-neutral-200, #e5e7eb)',
          borderRadius: '4px',
          fontSize: '0.8125rem',
          background: 'var(--color-neutral-50, #f9fafb)',
          flexShrink: 0,
        }}
      >
        {TEMPLATE_IDS.map((id) => (
          <option key={id} value={id}>{id}</option>
        ))}
      </select>

      <select
        value={activeMode}
        onChange={(e) => applySearch(brandInput, currentTemplate, e.target.value as InteractivityMode)}
        style={{
          padding: '6px 10px',
          border: '1px solid var(--color-neutral-200, #e5e7eb)',
          borderRadius: '4px',
          fontSize: '0.8125rem',
          background: 'var(--color-neutral-50, #f9fafb)',
          flexShrink: 0,
        }}
      >
        {INTERACTION_MODES.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>

      <a
        href={dataViewHref}
        onClick={handleDataViewClick}
        style={{
          padding: '6px 12px',
          border: '1px solid var(--color-neutral-200, #e5e7eb)',
          borderRadius: '4px',
          fontSize: '0.8125rem',
          color: 'var(--color-neutral-500, #6b7280)',
          textDecoration: 'none',
          flexShrink: 0,
          background: 'transparent',
          cursor: 'pointer',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-neutral-100, #f3f4f6)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        brand data
      </a>

      <button
        onClick={handleBrandLoad}
        disabled={isLoading}
        style={{
          padding: '6px 16px',
          background: 'var(--color-primary, #6366f1)',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          fontSize: '0.8125rem',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          opacity: isLoading ? 0.6 : 1,
          flexShrink: 0,
          transition: 'opacity 0.1s',
        }}
        onMouseEnter={(e) => { if (!isLoading) e.currentTarget.style.opacity = '0.85'; }}
        onMouseLeave={(e) => { if (!isLoading) e.currentTarget.style.opacity = '1'; }}
      >
        {isLoading ? 'Loading...' : 'Load'}
      </button>

      <details style={{ flexShrink: 0, position: 'relative' }}>
        <summary
          style={{
            cursor: 'pointer',
            color: 'var(--color-neutral-500, #6b7280)',
            fontSize: '0.8125rem',
            display: 'block',
            listStyle: 'none',
          }}
        >
          examples &#9662;
        </summary>
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            background: 'var(--color-neutral-50, #f9fafb)',
            border: '1px solid var(--color-neutral-200, #e5e7eb)',
            borderRadius: '4px',
            padding: '4px',
            zIndex: 50,
            minWidth: '200px',
          }}
        >
          {BRAND_EXAMPLES.map((ex) => (
            <button
              key={ex.value}
              onClick={() => loadExample(ex.value)}
              style={{
                display: 'block',
                width: '100%',
                padding: '6px 12px',
                textAlign: 'left',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: '0.8125rem',
                borderRadius: '4px',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-neutral-100, #f3f4f6)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {ex.label}
            </button>
          ))}
        </div>
      </details>
    </nav>
  );
}
