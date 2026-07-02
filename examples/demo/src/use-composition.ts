// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { useState, useEffect, useRef } from 'react';
import { compositionFromHash, encodeComposition } from '@booga/vbrand/composition';
import type { CompositionSpec } from '@booga/vbrand/composition';
import { TEMPLATE_REGISTRY, compositionMatchesTemplate } from '@booga/vbrand/templates';
import { contentFromHash, contentToHash } from '@booga/vbrand/content';
import type { ContentOverrideMap } from '@booga/vbrand/content';
import type { TemplateId } from './router';

export interface UseCompositionResult {
  composition: CompositionSpec;
  setComposition: React.Dispatch<React.SetStateAction<CompositionSpec>>;
  handleReset: () => void;
  userContent: ContentOverrideMap;
  setUserContent: React.Dispatch<React.SetStateAction<ContentOverrideMap>>;
}

export function useComposition(templateId: TemplateId): UseCompositionResult {
  const template = TEMPLATE_REGISTRY[templateId];

  const [composition, setComposition] = useState<CompositionSpec>(() => {
    const fromHash = compositionFromHash(window.location.hash);
    return compositionMatchesTemplate(fromHash, templateId)
      ? fromHash
      : template.defaultComposition();
  });

  const [userContent, setUserContent] = useState<ContentOverrideMap>(() =>
    contentFromHash(window.location.hash) ?? {},
  );

  const prevTemplateRef = useRef<TemplateId>(templateId);

  useEffect(() => {
    if (prevTemplateRef.current === templateId) return;
    prevTemplateRef.current = templateId;
    setComposition((prev) =>
      compositionMatchesTemplate(prev, templateId) ? prev : template.defaultComposition(),
    );
    setUserContent({});
  }, [templateId]);

  useEffect(() => {
    const compositionPart = encodeComposition(composition);
    const hasUserContent = Object.keys(userContent).length > 0;
    const hash = hasUserContent
      ? `#composition=${compositionPart}&${contentToHash(userContent)}`
      : `#composition=${compositionPart}`;
    history.replaceState(null, '', window.location.pathname + window.location.search + hash);
  }, [composition, userContent]);

  function handleReset() {
    setComposition(template.defaultComposition());
    setUserContent({});
  }

  return { composition, setComposition, handleReset, userContent, setUserContent };
}
