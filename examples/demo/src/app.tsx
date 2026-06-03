// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import React, { useEffect, useState } from 'react';
import type { VbrandType } from '@booga/vbrand/adapters/browser';
import { NavBar } from './nav-bar';
import { TemplateView } from './template-view';
import { DataView } from './data-view';
import { parseRoute, parseViewFromPath, buildViewPath, brandParamToString, type ViewTab } from './router';
import { loadBrand, type BrandMeta } from './brand-loader';
import { applyBrandTokens, clearBrandTokens } from './brand-tokens';
import { ParkNotice } from './park-notice';
import { formatZodError } from './zod-error-format';

const DEFAULT_META: BrandMeta = { colorFallbackActive: false, faviconBundled: false };

function viteBase(): string {
  return (typeof import.meta !== 'undefined' && (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL) ?? '/';
}

export function App() {
  const base = viteBase();
  const route = parseRoute(window.location.search, window.location.pathname, base);
  const brandLabel = brandParamToString(route.brandParams);

  const [brand, setBrand] = useState<VbrandType | null>(null);
  const [meta, setMeta] = useState<BrandMeta>(DEFAULT_META);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ViewTab>(route.view);

  useEffect(() => {
    function onPopState() {
      setActiveTab(parseViewFromPath(window.location.pathname, base));
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [base]);

  useEffect(() => {
    let cancelled = false;
    let appliedTokenKeys: string[] = [];
    setIsLoading(true);
    setError(null);
    loadBrand(route.brandParams)
      .then((result) => {
        if (cancelled) return;
        setBrand(result.brand);
        setMeta(result.meta);
        appliedTokenKeys = applyBrandTokens(result.brand);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setIsLoading(false);
      });
    return () => {
      cancelled = true;
      clearBrandTokens(appliedTokenKeys);
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <ParkNotice search={window.location.search} />
      <NavBar
        currentBrand={brandLabel}
        currentTemplate={route.templateId}
        currentMode={route.mode}
        isLoading={isLoading}
        dataViewHref={buildViewPath('data', base) + window.location.search + window.location.hash}
        onDataViewNavigate={() => {
          history.pushState(null, '', buildViewPath('data', base) + window.location.search + window.location.hash);
          setActiveTab('data');
        }}
      />

      <TabBar activeTab={activeTab} onTabChange={(tab) => {
        history.pushState(null, '', buildViewPath(tab, base) + window.location.search + window.location.hash);
        setActiveTab(tab);
      }} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {isLoading && <LoadingState label={brandLabel} />}
        {!isLoading && error && <ErrorState error={error} brandLabel={brandLabel} />}
        {!isLoading && !error && brand && activeTab === 'template' && (
          <TemplateView brand={brand} templateId={route.templateId} mode={route.mode} />
        )}
        {!isLoading && !error && brand && activeTab === 'data' && (
          <DataView brand={brand} sourceLabel={brandLabel} meta={meta} />
        )}
      </div>
    </div>
  );
}

function TabBar({ activeTab, onTabChange }: { activeTab: ViewTab; onTabChange: (t: ViewTab) => void }) {
  const tabs: Array<{ id: ViewTab; label: string }> = [
    { id: 'template', label: 'Template view' },
    { id: 'data', label: 'Brand data' },
  ];
  return (
    <div style={{ display: 'flex', borderBottom: '1px solid var(--color-neutral-200, #e5e7eb)', padding: '0 20px', background: 'var(--color-neutral-50, #f9fafb)' }}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          style={{
            padding: '10px 16px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: '0.8125rem',
            fontWeight: activeTab === tab.id ? 600 : 400,
            color: activeTab === tab.id ? 'var(--color-primary, #6366f1)' : 'var(--color-neutral-500, #6b7280)',
            borderBottom: activeTab === tab.id ? '2px solid var(--color-primary, #6366f1)' : '2px solid transparent',
            marginBottom: '-1px',
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '8px' }}>
      <code style={{ fontSize: '0.8125rem', background: 'var(--color-neutral-50, #f9fafb)', border: '1px solid var(--color-neutral-200, #e5e7eb)', padding: '6px 12px', borderRadius: '4px', color: 'var(--color-neutral-700, #374151)' }}>{label}</code>
      <span style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-neutral-400, #9ca3af)' }}>extracting brand signal</span>
    </div>
  );
}

function isCorsError(message: string): boolean {
  return message.includes('CORS policy blocked');
}

function copyToClipboard(text: string) {
  navigator.clipboard?.writeText(text).catch(() => undefined);
}

function ErrorState({ error, brandLabel }: { error: string; brandLabel: string }) {
  const cors = isCorsError(error);
  const zodFormatted = formatZodError(error);
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
      <div style={{ background: '#fef2f2', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '4px', padding: '20px 24px', maxWidth: '600px', width: '100%' }}>
        <div style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#ef4444', marginBottom: '10px' }}>confidence: none</div>
        <code style={{ fontSize: '0.8125rem', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', padding: '3px 8px', borderRadius: '4px', color: '#374151', display: 'inline-block', marginBottom: '12px' }}>{brandLabel}</code>
        {zodFormatted ? (
          <div style={{ marginBottom: '14px' }}>
            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>{zodFormatted.summary}</div>
            <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: '0.8125rem', color: 'var(--color-neutral-500, #6b7280)' }}>
              {zodFormatted.fields.map((f) => (
                <li key={f.path}><code style={{ fontSize: '0.75rem', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', padding: '1px 5px', borderRadius: '4px', color: '#374151' }}>{f.path}</code>: {f.message}</li>
              ))}
            </ul>
          </div>
        ) : (
          <pre style={{ fontSize: '0.8125rem', color: 'var(--color-neutral-500, #6b7280)', whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: '0 0 14px' }}>{error}</pre>
        )}
        {cors && (
          <div style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '4px', padding: '10px 12px', marginBottom: '14px' }}>
            <div style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#ef4444', marginBottom: '6px' }}>cors limitation</div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-neutral-500, #6b7280)', margin: '0 0 8px' }}>
              Live URL extraction is browser-CORS-blocked on this hosted surface. Use the CLI locally:
            </p>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <code style={{ fontSize: '0.75rem', background: 'var(--color-neutral-50, #f9fafb)', padding: '4px 8px', borderRadius: '4px', flex: 1, wordBreak: 'break-all', color: 'var(--color-neutral-700, #374151)' }}>
                {`vbrand pull ${brandLabel}`}
              </code>
              <button
                onClick={() => copyToClipboard(`vbrand pull ${brandLabel}`)}
                style={{ fontSize: '0.75rem', padding: '4px 10px', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', background: 'transparent', cursor: 'pointer', flexShrink: 0, color: 'var(--color-neutral-400, #9ca3af)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                copy
              </button>
            </div>
          </div>
        )}
        <div style={{ borderTop: '1px solid rgba(239,68,68,0.15)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'baseline' }}>
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#22c55e', flexShrink: 0 }}>offline</span>
            <span style={{ fontSize: '0.8125rem', color: 'var(--color-neutral-500, #6b7280)' }}><code>fixture:</code> and <code>json:&lt;base64&gt;</code> load without network</span>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'baseline' }}>
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-neutral-400, #9ca3af)', flexShrink: 0 }}>live</span>
            <span style={{ fontSize: '0.8125rem', color: 'var(--color-neutral-500, #6b7280)' }}>URL, <code>github:</code> and <code>npm:</code> fetch live and may be blocked by CORS</span>
          </div>
        </div>
      </div>
    </div>
  );
}
