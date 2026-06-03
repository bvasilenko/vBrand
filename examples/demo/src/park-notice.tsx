// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import React, { useState } from 'react';

const QUEUED_AXIS_PARAMS: Array<{ param: string; label: string; iteration: string }> = [
  { param: 'stack', label: 'stack-runtime', iteration: 'iteration 3 queued' },
  { param: 'cms',   label: 'cms substrate', iteration: 'iteration 3 queued' },
];

const SESSION_KEY = 'vbrand-park-notice-dismissed';

interface ParkNoticeProps {
  search: string;
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
    try { sessionStorage.setItem(SESSION_KEY, '1'); } catch { /* quota or private mode */ }
  }

  return (
    <div
      role="banner"
      aria-label="Queued axes notice"
      style={{
        background: '#fefce8',
        border: '1px solid rgba(234,179,8,0.4)',
        borderLeft: '4px solid #eab308',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        fontSize: '0.8125rem',
      }}
    >
      <div style={{ flex: 1 }}>
        <span style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#eab308', marginRight: '8px' }}>alpha.4:</span>
        {activeAxes.map(({ param, label, iteration }, i) => (
          <span key={param}>
            {i > 0 && ' / '}
            <strong>{label}</strong>
            <span style={{ color: 'var(--color-neutral-500, #6b7280)', marginLeft: '4px' }}>({iteration})</span>
          </span>
        ))}
        <span style={{ color: 'var(--color-neutral-500, #6b7280)', marginLeft: '8px' }}>
          -- these URL params are no-ops at this release; runtime surfaces ship in iterations 2-3.
        </span>
      </div>
      <button
        onClick={dismiss}
        aria-label="Dismiss queued axes notice"
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--color-neutral-400, #9ca3af)',
          fontSize: '1rem',
          lineHeight: 1,
          padding: '2px 4px',
          flexShrink: 0,
          borderRadius: '4px',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(234,179,8,0.1)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >
        ×
      </button>
    </div>
  );
}
