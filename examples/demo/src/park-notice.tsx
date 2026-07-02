// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import React, { useState } from 'react';

interface ParkNoticeProps {
  search: string;
}

const SESSION_KEY = 'vbrand-park-notice-dismissed';

const QUEUED_AXIS_PARAMS: Array<{ param: string; label: string; release: string }> = [
  { param: 'deploy', label: 'multi-deploy target selection', release: 'vBrand 0.5.0' },
  { param: 'stackPlugin', label: 'expanded stack runtime plugins', release: 'vBrand 0.5.0' },
  { param: 'cmsLive', label: 'managed CMS live instances', release: 'vBrand 0.5.0' },
];

const noticeStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '12px',
  background: '#fefce8',
  border: '1px solid rgba(234,179,8,0.4)',
  borderLeft: '4px solid #eab308',
  borderRadius: '4px',
  padding: '12px 16px',
  fontSize: '0.8125rem',
  fontFamily: 'system-ui, sans-serif',
  lineHeight: 1.45,
  color: 'var(--color-neutral-700, #374151)',
};

const eyebrowStyle: React.CSSProperties = {
  marginRight: '8px',
  fontSize: '0.6875rem',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#eab308',
};

const releaseStyle: React.CSSProperties = {
  marginLeft: '4px',
  color: 'var(--color-neutral-500, #6b7280)',
};

const dismissButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid transparent',
  borderRadius: '4px',
  color: 'var(--color-neutral-400, #9ca3af)',
  cursor: 'pointer',
  fontSize: '0.9375rem',
  lineHeight: 1,
  padding: '2px 4px',
  flexShrink: 0,
  transition: 'background 0.12s ease, border-color 0.12s ease, color 0.12s ease',
};

function setDismissActive(el: HTMLButtonElement, active: boolean) {
  el.style.borderColor = active ? 'rgba(234,179,8,0.35)' : 'transparent';
  el.style.background = active ? 'rgba(234,179,8,0.10)' : 'transparent';
  el.style.color = active ? '#eab308' : 'var(--color-neutral-400, #9ca3af)';
}

export function ParkNotice({ search }: ParkNoticeProps) {
  const [dismissed, setDismissed] = useState(() =>
    typeof sessionStorage !== 'undefined' && sessionStorage.getItem(SESSION_KEY) === '1',
  );
  const params = new URLSearchParams(search);
  const activeAxes = QUEUED_AXIS_PARAMS.filter(({ param }) => params.has(param));

  if (dismissed || activeAxes.length === 0) return null;

  function dismiss() {
    setDismissed(true);
    try { sessionStorage.setItem(SESSION_KEY, '1'); } catch { /* Storage can be blocked; React state still dismisses this banner. */ }
  }

  return (
    <div role="banner" aria-label="Queued axes notice" style={noticeStyle}>
      <div style={{ flex: 1 }}>
        <span style={eyebrowStyle}>bridge queue:</span>
        {activeAxes.map(({ param, label, release }, index) => (
          <span key={param}>
            {index > 0 && ' / '}
            <strong>{label}</strong>
            <span style={releaseStyle}>({release})</span>
          </span>
        ))}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss queued axes notice"
        style={dismissButtonStyle}
        onMouseEnter={(e) => setDismissActive(e.currentTarget, true)}
        onMouseLeave={(e) => setDismissActive(e.currentTarget, false)}
        onFocus={(e) => { setDismissActive(e.currentTarget, true); e.currentTarget.style.outline = '2px solid #eab308'; e.currentTarget.style.outlineOffset = '1px'; }}
        onBlur={(e) => { setDismissActive(e.currentTarget, false); e.currentTarget.style.outline = ''; e.currentTarget.style.outlineOffset = ''; }}
      >×</button>
    </div>
  );
}
