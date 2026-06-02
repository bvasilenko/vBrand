// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import React, { useState } from 'react';
import type { CompositionSpec, Density, SectionSpec } from './spec.js';
import { sectionsByOrder, updateSection, reorderSections } from './spec.js';

export interface CompositionEditorProps {
  spec: CompositionSpec;
  onChange: (spec: CompositionSpec) => void;
  onReset: () => void;
}

export function CompositionEditor({ spec, onChange, onReset }: CompositionEditorProps) {
  const [dragFromOrder, setDragFromOrder] = useState<number | null>(null);
  const sorted = sectionsByOrder(spec);

  function handleToggle(id: string) {
    onChange(updateSection(spec, id, { visible: !spec.sections.find((s) => s.id === id)!.visible }));
  }

  function handleDensity(id: string, density: Density) {
    onChange(updateSection(spec, id, { density }));
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
        <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Sections</span>
        <button
          onClick={onReset}
          style={{
            fontSize: '0.75rem',
            padding: '2px 8px',
            cursor: 'pointer',
            borderRadius: '4px',
            border: '1px solid var(--color-neutral-200, #d1d5db)',
            background: 'transparent',
          }}
        >
          Reset
        </button>
      </div>

      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {sorted.map((section) => (
          <SectionRow
            key={section.id}
            section={section}
            onToggle={handleToggle}
            onDensity={handleDensity}
            onDragStart={() => handleDragStart(section.order)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(section.order)}
          />
        ))}
      </ul>
    </aside>
  );
}

interface SectionRowProps {
  section: SectionSpec;
  onToggle: (id: string) => void;
  onDensity: (id: string, density: Density) => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
}

function SectionRow({ section, onToggle, onDensity, onDragStart, onDragOver, onDrop }: SectionRowProps) {
  return (
    <li
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={{
        padding: '8px',
        borderRadius: '6px',
        border: '1px solid var(--color-neutral-200, #e5e7eb)',
        background: section.visible ? 'white' : 'var(--color-neutral-50, #f9fafb)',
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
          id={`section-${section.id}`}
          checked={section.visible}
          onChange={() => onToggle(section.id)}
          style={{ cursor: 'pointer' }}
        />
        <label
          htmlFor={`section-${section.id}`}
          style={{ fontSize: '0.8125rem', fontWeight: 500, cursor: 'pointer', flex: 1 }}
        >
          {section.id}
        </label>
      </div>
      {section.visible && (
        <select
          value={section.density}
          onChange={(e) => onDensity(section.id, e.target.value as Density)}
          style={{
            fontSize: '0.75rem',
            padding: '2px 4px',
            borderRadius: '4px',
            border: '1px solid var(--color-neutral-200, #d1d5db)',
            cursor: 'pointer',
            background: 'transparent',
          }}
        >
          <option value="compact">Compact</option>
          <option value="regular">Regular</option>
          <option value="spacious">Spacious</option>
        </select>
      )}
    </li>
  );
}
