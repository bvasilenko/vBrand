// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import React, { useState, useEffect } from 'react';
import type { VbrandType } from '@booga/vbrand/adapters/browser';
import { CompositionEditorDemo } from './composition-editor-demo';
import { compositionFromHash, compositionToHash } from '@booga/vbrand/composition';
import { TEMPLATE_REGISTRY, compositionMatchesTemplate } from '@booga/vbrand/templates';
import type { TemplateId } from './router';

interface TemplateViewProps {
  brand: VbrandType;
  templateId: TemplateId;
}

export function TemplateView({ brand, templateId }: TemplateViewProps) {
  const template = TEMPLATE_REGISTRY[templateId];

  const [composition, setComposition] = useState(() => {
    const fromHash = compositionFromHash(window.location.hash);
    return compositionMatchesTemplate(fromHash, templateId)
      ? fromHash
      : template.defaultComposition();
  });

  useEffect(() => {
    const hash = compositionToHash(composition);
    history.replaceState(null, '', window.location.pathname + window.location.search + hash);
  }, [composition]);

  useEffect(() => {
    setComposition((prev) =>
      compositionMatchesTemplate(prev, templateId)
        ? prev
        : template.defaultComposition(),
    );
  }, [templateId]);

  function handleReset() {
    setComposition(template.defaultComposition());
  }

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
      <CompositionEditorDemo
        spec={composition}
        onChange={setComposition}
        onReset={handleReset}
      />
      <div style={{ flex: 1, overflow: 'auto' }}>
        {template.compose(brand, composition)}
      </div>
    </div>
  );
}
