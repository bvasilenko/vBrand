// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import React, { useState, useRef } from 'react';
import { deriveTargetMode } from '@booga/vbrand/stacks';
import type { TemplateId, InteractivityMode, StackName, CmsName } from './router';
import { buildSearchString, DEFAULT_MODE, DEFAULT_STACK, DEFAULT_CMS, STACK_NAMES, CMS_NAMES } from './router';

interface NavBarProps {
  currentBrand: string;
  currentTemplate: TemplateId;
  currentMode?: InteractivityMode;
  currentStack?: StackName;
  currentCms?: CmsName;
  isLoading: boolean;
  dataViewHref: string;
  onDataViewNavigate: () => void;
}

const TEMPLATE_IDS: readonly TemplateId[] = ['landing', 'marketing', 'docs', 'dashboard'];
const INTERACTION_MODES: readonly InteractivityMode[] = ['static', 'hybrid', 'spa'];

const NAV_PRIMARY_FOCUS = 'var(--color-primary, #6366f1)';
const NAV_PRIMARY_TINT = 'rgba(99,102,241,0.06)';
const NAV_PRIMARY_TINT_STRONG = 'rgba(99,102,241,0.12)';
const NAV_PRIMARY_BORDER = 'rgba(99,102,241,0.35)';

function navFocusBind(el: { style: CSSStyleDeclaration }) {
  el.style.outline = `2px solid ${NAV_PRIMARY_FOCUS}`;
  el.style.outlineOffset = '1px';
}
function navFocusUnbind(el: { style: CSSStyleDeclaration }) {
  el.style.outline = '';
  el.style.outlineOffset = '';
}

function setNavSurfaceActive(el: { style: CSSStyleDeclaration }, active: boolean) {
  el.style.background = active ? NAV_PRIMARY_TINT : 'transparent';
  el.style.borderColor = active ? NAV_PRIMARY_BORDER : 'var(--color-neutral-200, #e5e7eb)';
  el.style.color = active ? NAV_PRIMARY_FOCUS : 'var(--color-neutral-500, #6b7280)';
}

function setExampleOptionActive(el: { style: CSSStyleDeclaration }, active: boolean) {
  el.style.background = active ? NAV_PRIMARY_TINT : 'transparent';
  el.style.borderLeftColor = active ? NAV_PRIMARY_FOCUS : 'transparent';
  el.style.color = active ? NAV_PRIMARY_FOCUS : 'var(--color-neutral-700, #374151)';
}

function setExamplesSummaryActive(el: { style: CSSStyleDeclaration }, active: boolean) {
  setNavSurfaceActive(el, active);
  el.style.borderLeftColor = NAV_PRIMARY_FOCUS;
}

const BRAND_EXAMPLES: Array<{ label: string; value: string }> = [
  { label: 'Stripe (fixture)', value: 'fixture:stripe' },
  { label: 'Vercel (fixture)', value: 'fixture:vercel' },
  { label: 'Linear (fixture)', value: 'fixture:linear' },
  { label: 'Notion (fixture)', value: 'fixture:notion' },
  { label: 'GitHub (fixture)', value: 'fixture:github' },
  { label: 'GitHub repo', value: 'github:bvasilenko/vBrand' },
  { label: 'npm package', value: 'npm:@booga/vbrand' },
];

const NAV_SELECT_STYLE: React.CSSProperties = {
  padding: '8px 12px',
  border: '1px solid var(--color-neutral-200, #e5e7eb)',
  borderLeft: '4px solid var(--color-neutral-200, #e5e7eb)',
  borderRadius: '4px',
  fontSize: '0.8125rem',
  fontWeight: 600,
  color: 'var(--color-neutral-700, #374151)',
  background: 'var(--color-neutral-50, #f9fafb)',
  flexShrink: 0,
};

function navAxisSelectStyle(accent: string): React.CSSProperties {
  return {
    ...NAV_SELECT_STYLE,
    borderLeft: `4px solid ${accent}`,
    fontVariantNumeric: 'tabular-nums',
  };
}

const NAV_AXIS_LABEL_STYLE: React.CSSProperties = {
  color: 'var(--color-neutral-400, #9ca3af)',
  flexShrink: 0,
  fontSize: '0.6875rem',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
};

export function NavBar({ currentBrand, currentTemplate, currentMode, currentStack, currentCms, isLoading, dataViewHref, onDataViewNavigate }: NavBarProps) {
  const [brandInput, setBrandInput] = useState(currentBrand);
  const activeMode = currentMode ?? DEFAULT_MODE;
  const activeStack = currentStack ?? DEFAULT_STACK;
  const activeCms = currentCms ?? DEFAULT_CMS;
  const detailsRef = useRef<HTMLDetailsElement>(null);

  function applySearch(brand: string, template: TemplateId, mode: InteractivityMode, stack?: StackName, cms?: CmsName) {
    const search = buildSearchString(brand, template, mode, stack ?? currentStack, cms ?? currentCms);
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

  function handleBrandInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setBrandInput(value);
    if (BRAND_EXAMPLES.some((ex) => ex.value === value)) {
      applySearch(value, currentTemplate, activeMode);
    }
  }

  function loadExample(value: string) {
    setBrandInput(value);
    applySearch(value, currentTemplate, activeMode);
    if (detailsRef.current) detailsRef.current.open = false;
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
        padding: '8px 24px',
        borderBottom: '1px solid var(--color-neutral-200, #e5e7eb)',
        background: 'var(--color-neutral-50, #f9fafb)',
        flexWrap: 'wrap',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '0.8125rem',
      }}
    >
      <span data-version-label style={{ fontWeight: 700, color: 'var(--color-primary, #6366f1)', flexShrink: 0 }}>
        {`vBrand ${__VBRAND_VERSION__}`}
      </span>

      <span style={NAV_AXIS_LABEL_STYLE}>brand</span>
      <input
        value={brandInput}
        onChange={handleBrandInputChange}
        onKeyDown={handleKeyDown}
        data-nav-brand-input
        list="brand-input-list"
        placeholder="fixture:stripe | github:owner/repo | npm:pkg | https://..."
        style={{
          flex: '1 1 300px',
          padding: '8px 12px',
          border: '1px solid var(--color-neutral-200, #e5e7eb)',
          borderLeft: '4px solid var(--color-primary, #6366f1)',
          borderRadius: '4px',
          fontSize: '0.8125rem',
          fontFamily: 'monospace',
          minWidth: 0,
          color: 'var(--color-neutral-700, #374151)',
          background: 'var(--color-neutral-50, #f9fafb)',
        }}
        onFocus={(e) => navFocusBind(e.currentTarget)}
        onBlur={(e) => navFocusUnbind(e.currentTarget)}
      />
      <datalist id="brand-input-list">
        {BRAND_EXAMPLES.map((ex) => (
          <option key={ex.value} value={ex.value} />
        ))}
      </datalist>

      <span style={NAV_AXIS_LABEL_STYLE}>app type</span>
      <select
        data-axis="app"
        value={currentTemplate}
        onChange={(e) => applySearch(brandInput, e.target.value as TemplateId, activeMode)}
        style={navAxisSelectStyle('var(--color-primary, #6366f1)')}
        onFocus={(e) => navFocusBind(e.currentTarget)}
        onBlur={(e) => navFocusUnbind(e.currentTarget)}
      >
        {TEMPLATE_IDS.map((id) => (
          <option key={id} value={id}>{id}</option>
        ))}
      </select>

      <span style={NAV_AXIS_LABEL_STYLE}>mode</span>
      <select
        data-axis="mode"
        value={activeMode}
        onChange={(e) => applySearch(brandInput, currentTemplate, e.target.value as InteractivityMode)}
        style={navAxisSelectStyle('#eab308')}
        onFocus={(e) => navFocusBind(e.currentTarget)}
        onBlur={(e) => navFocusUnbind(e.currentTarget)}
      >
        {INTERACTION_MODES.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>

      <span style={NAV_AXIS_LABEL_STYLE}>stack</span>
      <select
        value={activeStack}
        data-axis="stack"
        onChange={(e) => { const nextStack = e.target.value as StackName; applySearch(brandInput, currentTemplate, deriveTargetMode(activeMode, activeStack, nextStack), nextStack); }}
        style={navAxisSelectStyle('var(--color-primary, #6366f1)')}
        onFocus={(e) => navFocusBind(e.currentTarget)}
        onBlur={(e) => navFocusUnbind(e.currentTarget)}
      >
        {STACK_NAMES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      <span style={NAV_AXIS_LABEL_STYLE}>cms</span>
      <select
        value={activeCms}
        data-axis="cms"
        onChange={(e) => applySearch(brandInput, currentTemplate, activeMode, undefined, e.target.value as CmsName)}
        style={navAxisSelectStyle('#22c55e')}
        onFocus={(e) => navFocusBind(e.currentTarget)}
        onBlur={(e) => navFocusUnbind(e.currentTarget)}
      >
        {CMS_NAMES.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      <a
        href={dataViewHref}
        onClick={handleDataViewClick}
        style={{
          padding: '8px 12px',
          border: '1px solid var(--color-neutral-200, #e5e7eb)',
          borderRadius: '4px',
          fontSize: '0.8125rem',
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--color-neutral-500, #6b7280)',
          textDecoration: 'none',
          flexShrink: 0,
          background: 'transparent',
          cursor: 'pointer',
          transition: 'background 0.12s ease, border-color 0.12s ease, color 0.12s ease',
        }}
        onMouseEnter={(e) => setNavSurfaceActive(e.currentTarget, true)}
        onMouseLeave={(e) => setNavSurfaceActive(e.currentTarget, false)}
        onMouseDown={(e) => { e.currentTarget.style.background = NAV_PRIMARY_TINT_STRONG; }}
        onMouseUp={(e) => setNavSurfaceActive(e.currentTarget, true)}
        onFocus={(e) => navFocusBind(e.currentTarget)}
        onBlur={(e) => { navFocusUnbind(e.currentTarget); setNavSurfaceActive(e.currentTarget, false); }}
      >
        brand data
      </a>

      <button
        onClick={handleBrandLoad}
        disabled={isLoading}
        style={{
          padding: '8px 12px',
          background: 'var(--color-primary, #6366f1)',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          fontSize: '0.8125rem',
          fontWeight: 700,
          letterSpacing: '0.08em',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          opacity: isLoading ? 0.6 : 1,
          flexShrink: 0,
          transition: 'opacity 0.1s',
        }}
        onMouseEnter={(e) => { if (!isLoading) e.currentTarget.style.opacity = '0.85'; }}
        onMouseLeave={(e) => { if (!isLoading) e.currentTarget.style.opacity = '1'; }}
        onFocus={(e) => navFocusBind(e.currentTarget)}
        onBlur={(e) => navFocusUnbind(e.currentTarget)}
      >
        {isLoading ? 'Loading...' : 'Load'}
      </button>

      <details
        ref={detailsRef}
        style={{ flexShrink: 0, position: 'relative' }}
        onKeyDown={(e) => { if (e.key === 'Escape' && detailsRef.current) detailsRef.current.open = false; }}
      >
        <summary
          style={{
            cursor: 'pointer',
            color: 'var(--color-neutral-500, #6b7280)',
            fontSize: '0.8125rem',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            display: 'block',
            listStyle: 'none',
            border: '1px solid var(--color-neutral-200, #e5e7eb)',
            borderLeft: '4px solid var(--color-primary, #6366f1)',
            borderRadius: '4px',
            padding: '8px 12px 8px 8px',
            background: 'transparent',
            transition: 'background 0.12s ease, border-color 0.12s ease, color 0.12s ease',
          }}
          onMouseEnter={(e) => setExamplesSummaryActive(e.currentTarget, true)}
          onMouseLeave={(e) => setExamplesSummaryActive(e.currentTarget, false)}
          onMouseDown={(e) => { e.currentTarget.style.background = NAV_PRIMARY_TINT_STRONG; }}
          onMouseUp={(e) => setExamplesSummaryActive(e.currentTarget, true)}
          onFocus={(e) => { navFocusBind(e.currentTarget); setExamplesSummaryActive(e.currentTarget, true); }}
          onBlur={(e) => { navFocusUnbind(e.currentTarget); setExamplesSummaryActive(e.currentTarget, false); }}
        >
          examples &#9662;
        </summary>
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            background: 'var(--color-neutral-50, #f9fafb)',
            border: '1px solid var(--color-neutral-200, #e5e7eb)',
            borderRadius: '4px',
            padding: '4px',
            zIndex: 50,
            minWidth: '200px',
            maxWidth: 'min(280px, calc(100vw - 32px))',
            maxHeight: '60vh',
            overflowY: 'auto',
          }}
        >
          {BRAND_EXAMPLES.map((ex) => (
            <button
              key={ex.value}
              onClick={() => loadExample(ex.value)}
              {...(ex.value.startsWith('fixture:') ? { 'data-fixture-handle': ex.value.slice('fixture:'.length) } : {})}
              style={{
                display: 'block',
                width: '100%',
                padding: '8px 12px',
                textAlign: 'left',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: '0.8125rem',
                fontWeight: ex.value.startsWith('fixture:') ? 700 : 600,
                color: 'var(--color-neutral-700, #374151)',
                fontFamily: ex.value.startsWith('fixture:') ? 'system-ui, sans-serif' : 'monospace',
                borderRadius: '4px',
                borderLeft: '4px solid transparent',
                transition: 'background 0.12s ease, border-color 0.12s ease, color 0.12s ease',
              }}
              onMouseEnter={(e) => setExampleOptionActive(e.currentTarget, true)}
              onMouseLeave={(e) => setExampleOptionActive(e.currentTarget, false)}
              onMouseDown={(e) => { e.currentTarget.style.background = NAV_PRIMARY_TINT_STRONG; }}
              onMouseUp={(e) => setExampleOptionActive(e.currentTarget, true)}
              onFocus={(e) => { navFocusBind(e.currentTarget); setExampleOptionActive(e.currentTarget, true); }}
              onBlur={(e) => { navFocusUnbind(e.currentTarget); setExampleOptionActive(e.currentTarget, false); }}
            >
              {ex.label}
            </button>
          ))}
        </div>
      </details>
    </nav>
  );
}
