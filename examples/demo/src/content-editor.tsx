// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { VbrandType } from '@booga/vbrand/adapters/browser';
import type { ContentOverrideMap, OverridableField } from '@booga/vbrand/content';
import { OVERRIDABLE_FIELDS } from '@booga/vbrand/content';
import type { TemplateId } from './router';

interface ContentEditorProps {
  brand: VbrandType;
  templateId: TemplateId;
  content: ContentOverrideMap;
  onChange: (content: ContentOverrideMap) => void;
  onReset: () => void;
}

const DEBOUNCE_MS = 250;

function toDisplayString(value: string | string[] | undefined): string {
  if (value === undefined) return '';
  return Array.isArray(value) ? value.join('\n') : value;
}

export function ContentEditor({
  brand,
  templateId,
  content,
  onChange,
  onReset,
}: ContentEditorProps) {
  const fields = OVERRIDABLE_FIELDS[templateId] ?? [];

  function handleFieldChange(key: OverridableField['key'], val: string | string[] | undefined): void {
    if (val === undefined) {
      const next = { ...content };
      delete next[key];
      onChange(next);
    } else {
      onChange({ ...content, [key]: val });
    }
  }

  return (
    <aside
      style={{
        width: '240px',
        padding: '16px',
        borderLeft: '1px solid var(--color-neutral-200, #e5e7eb)',
        background: 'var(--color-neutral-50, #f9fafb)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        minHeight: '100vh',
        overflowY: 'auto',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-neutral-400, #9ca3af)' }}>
          Content
        </span>
        <button
          onClick={onReset}
          style={{
            fontSize: '0.75rem',
            padding: '2px 8px',
            cursor: 'pointer',
            borderRadius: '4px',
            border: '1px solid var(--color-neutral-200, #e5e7eb)',
            background: 'transparent',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-neutral-100, #f3f4f6)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          onFocus={(e) => { e.currentTarget.style.outline = '2px solid var(--color-primary, #6366f1)'; e.currentTarget.style.outlineOffset = '1px'; }}
          onBlur={(e) => { e.currentTarget.style.outline = ''; e.currentTarget.style.outlineOffset = ''; }}
        >
          Reset
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {fields.map((field) => (
          <FieldRow
            key={field.key}
            field={field}
            brand={brand}
            currentValue={content[field.key]}
            onChange={(val) => handleFieldChange(field.key, val)}
          />
        ))}
      </div>
    </aside>
  );
}

interface FieldRowProps {
  field: OverridableField;
  brand: VbrandType;
  currentValue: string | string[] | undefined;
  onChange: (value: string | string[] | undefined) => void;
}

function FieldRow({ field, brand, currentValue, onChange }: FieldRowProps) {
  const placeholder = field.defaultValue(brand);
  const [localVal, setLocalVal] = useState(() => toDisplayString(currentValue));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setLocalVal(toDisplayString(currentValue));
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, [currentValue]);

  const handleChange = useCallback(
    (raw: string) => {
      setLocalVal(raw);
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        if (raw === '') {
          onChange(undefined);
        } else if (field.kind === 'list') {
          onChange(raw.split('\n').filter(Boolean));
        } else {
          onChange(raw);
        }
      }, DEBOUNCE_MS);
    },
    [field.kind, onChange],
  );

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '4px 8px',
    border: '1px solid var(--color-neutral-200, #e5e7eb)',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontFamily: 'system-ui, sans-serif',
    background: currentValue !== undefined ? '#fff' : 'transparent',
    color: 'var(--color-neutral-700, #374151)',
    boxSizing: 'border-box',
    resize: 'vertical',
  };

  function handleFocusRing(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
    e.currentTarget.style.outline = '2px solid var(--color-primary, #6366f1)';
    e.currentTarget.style.outlineOffset = '1px';
  }

  function handleBlurRing(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
    e.currentTarget.style.outline = '';
    e.currentTarget.style.outlineOffset = '';
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <label
        style={{
          fontSize: '0.6875rem',
          color: 'var(--color-neutral-500, #6b7280)',
          fontWeight: currentValue !== undefined ? 600 : 400,
        }}
      >
        {field.label}
      </label>
      {field.kind === 'list' ? (
        <textarea
          value={localVal}
          placeholder={placeholder}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={handleFocusRing}
          onBlur={handleBlurRing}
          rows={3}
          style={inputStyle}
        />
      ) : (
        <input
          type="text"
          value={localVal}
          placeholder={placeholder}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={handleFocusRing}
          onBlur={handleBlurRing}
          style={inputStyle}
        />
      )}
    </div>
  );
}
