// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import React, { useState, useEffect } from 'react';
import type { VbrandType } from '@booga/vbrand/adapters/browser';
import { CompositionEditor } from '@booga/vbrand/composition';
import { compositionFromHash, compositionToHash } from '@booga/vbrand/composition';
import { TEMPLATE_REGISTRY } from '@booga/vbrand/templates';
import type { TemplateId } from './router';

interface TemplateViewProps {
  brand: VbrandType;
  templateId: TemplateId;
}

export function TemplateView({ brand, templateId }: TemplateViewProps) {
  const template = TEMPLATE_REGISTRY[templateId];
  const [composition, setComposition] = useState(() => {
    return compositionFromHash(window.location.hash) ?? template.defaultComposition();
  });

  useEffect(() => {
    const hash = compositionToHash(composition);
    history.replaceState(null, '', window.location.pathname + window.location.search + hash);
  }, [composition]);

  function handleReset() {
    setComposition(template.defaultComposition());
  }

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
      <CompositionEditor
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
