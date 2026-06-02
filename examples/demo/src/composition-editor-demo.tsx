// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import React, { useState } from 'react';
import type { CompositionSpec, SectionSpec, Density } from '@booga/vbrand/composition';
import { sectionsByOrder, updateSection, reorderSections, DensityChips } from '@booga/vbrand/composition';

export interface CompositionEditorDemoProps {
  spec: CompositionSpec;
  onChange: (spec: CompositionSpec) => void;
  onReset: () => void;
}

export function CompositionEditorDemo({ spec, onChange, onReset }: CompositionEditorDemoProps) {
  const [dragFromOrder, setDragFromOrder] = useState<number | null>(null);
  const sorted = sectionsByOrder(spec);

  function handleToggle(id: string) {
    const section = spec.sections.find((s) => s.id === id)!;
    onChange(updateSection(spec, id, { visible: !section.visible }));
  }

  function handleDensity(id: string, density: Density) {
    onChange(updateSection(spec, id, { density }));
  }

  function handleMove(fromOrder: number, toOrder: number) {
    onChange(reorderSections(spec, fromOrder, toOrder));
  }

  function handleDragStart(order: number) {
    setDragFromOrder(order);
  }

  function handleDrop(toOrder: number) {
    if (dragFromOrder === null || dragFromOrder === toOrder) {
      setDragFromOrder(null);
      return;
    }
    onChange(reorderSections(spec, dragFromOrder, toOrder));
    setDragFromOrder(null);
  }

  return (
    <aside
      style={{
        width: '240px',
        padding: '16px',
        borderRight: '1px solid var(--color-neutral-200, #e5e7eb)',
        background: 'var(--color-neutral-50, #f9fafb)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        minHeight: '100vh',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-neutral-400, #9ca3af)' }}>Sections</span>
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
        >
          Reset
        </button>
      </div>

      <ul
        role="listbox"
        aria-label="Composition sections"
        style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}
      >
        {sorted.map((section) => (
          <DemoSectionRow
            key={section.id}
            section={section}
            onToggle={handleToggle}
            onDensity={handleDensity}
            onMoveUp={section.order > 0 ? () => handleMove(section.order, section.order - 1) : null}
            onMoveDown={section.order < sorted.length - 1 ? () => handleMove(section.order, section.order + 1) : null}
            onDragStart={() => handleDragStart(section.order)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(section.order)}
          />
        ))}
      </ul>
    </aside>
  );
}

interface DemoSectionRowProps {
  section: SectionSpec;
  onToggle: (id: string) => void;
  onDensity: (id: string, density: Density) => void;
  onMoveUp: (() => void) | null;
  onMoveDown: (() => void) | null;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
}

function DemoSectionRow({
  section,
  onToggle,
  onDensity,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDragOver,
  onDrop,
}: DemoSectionRowProps) {
  return (
    <li
      role="option"
      data-section-id={section.id}
      draggable
      tabIndex={0}
      aria-label={section.id}
      aria-selected={section.visible}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp')   { e.preventDefault(); onMoveUp?.(); }
        if (e.key === 'ArrowDown') { e.preventDefault(); onMoveDown?.(); }
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(section.id); }
      }}
      style={{
        padding: '8px',
        borderRadius: '4px',
        border: '1px solid var(--color-neutral-200, #e5e7eb)',
        background: section.visible ? '#ffffff' : 'var(--color-neutral-50, #f9fafb)',
        cursor: 'grab',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        opacity: section.visible ? 1 : 0.5,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <input
          type="checkbox"
          id={`demo-section-${section.id}`}
          checked={section.visible}
          onChange={() => onToggle(section.id)}
          style={{ cursor: 'pointer' }}
        />
        <label
          htmlFor={`demo-section-${section.id}`}
          style={{ fontSize: '0.8125rem', fontWeight: 500, cursor: 'pointer', flex: 1, fontFamily: 'monospace' }}
        >
          {section.id}
        </label>
        <div style={{ display: 'flex', gap: '2px' }}>
          <button
            onClick={onMoveUp ?? undefined}
            disabled={!onMoveUp}
            aria-label={`Move ${section.id} up`}
            style={{
              fontSize: '0.75rem',
              lineHeight: 1,
              padding: '2px 4px',
              borderRadius: '4px',
              border: '1px solid var(--color-neutral-200, #e5e7eb)',
              background: 'transparent',
              cursor: onMoveUp ? 'pointer' : 'not-allowed',
              opacity: onMoveUp ? 1 : 0.3,
            }}
            onMouseEnter={(e) => { if (onMoveUp) e.currentTarget.style.background = 'var(--color-neutral-100, #f3f4f6)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            &#x25B4;
          </button>
          <button
            onClick={onMoveDown ?? undefined}
            disabled={!onMoveDown}
            aria-label={`Move ${section.id} down`}
            style={{
              fontSize: '0.75rem',
              lineHeight: 1,
              padding: '2px 4px',
              borderRadius: '4px',
              border: '1px solid var(--color-neutral-200, #e5e7eb)',
              background: 'transparent',
              cursor: onMoveDown ? 'pointer' : 'not-allowed',
              opacity: onMoveDown ? 1 : 0.3,
            }}
            onMouseEnter={(e) => { if (onMoveDown) e.currentTarget.style.background = 'var(--color-neutral-100, #f3f4f6)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            &#x25BE;
          </button>
        </div>
      </div>
      {section.visible && (
        <DensityChips sectionId={section.id} active={section.density} onSelect={onDensity} />
      )}
    </li>
  );
}
