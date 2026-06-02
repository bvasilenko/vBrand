// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import React, { useEffect, useState } from 'react';
import type { VbrandType } from '@booga/vbrand/adapters/browser';
import { NavBar } from './nav-bar';
import { TemplateView } from './template-view';
import { DataView } from './data-view';
import { parseRoute, brandParamToString } from './router';
import { loadBrand } from './brand-loader';

type ViewTab = 'template' | 'data';

export function App() {
  const route = parseRoute(window.location.search);
  const brandLabel = brandParamToString(route.brandParams);

  const [brand, setBrand] = useState<VbrandType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ViewTab>('template');

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    loadBrand(route.brandParams)
      .then((result) => {
        if (!cancelled) {
          setBrand(result);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setIsLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <NavBar
        currentBrand={brandLabel}
        currentTemplate={route.templateId}
        isLoading={isLoading}
      />

      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {isLoading && <LoadingState label={brandLabel} />}
        {!isLoading && error && <ErrorState error={error} brandLabel={brandLabel} />}
        {!isLoading && !error && brand && activeTab === 'template' && (
          <TemplateView brand={brand} templateId={route.templateId} />
        )}
        {!isLoading && !error && brand && activeTab === 'data' && (
          <DataView brand={brand} sourceLabel={brandLabel} />
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

function ErrorState({ error, brandLabel }: { error: string; brandLabel: string }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
      <div style={{ background: '#fef2f2', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '4px', padding: '20px 24px', maxWidth: '600px', width: '100%' }}>
        <div style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#ef4444', marginBottom: '10px' }}>confidence: none</div>
        <code style={{ fontSize: '0.8125rem', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', padding: '3px 8px', borderRadius: '4px', color: '#374151', display: 'inline-block', marginBottom: '12px' }}>{brandLabel}</code>
        <pre style={{ fontSize: '0.8125rem', color: 'var(--color-neutral-500, #6b7280)', whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: '0 0 14px' }}>{error}</pre>
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
