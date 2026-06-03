// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import React, { useState, useEffect, useRef } from 'react';
import type { VbrandType } from '@booga/vbrand/adapters/browser';
import { CompositionEditorDemo } from './composition-editor-demo';
import { compositionFromHash, encodeComposition } from '@booga/vbrand/composition';
import { TEMPLATE_REGISTRY, compositionMatchesTemplate } from '@booga/vbrand/templates';
import { contentFromHash, contentToHash } from '@booga/vbrand/content';
import type { ContentOverrideMap } from '@booga/vbrand/content';
import { ContentEditor } from './content-editor';
import { staticRender, hybridRender, hydrateIslands } from '@booga/vbrand/interactivity';
import type { IslandManifest } from '@booga/vbrand/interactivity';
import type { TemplateId, InteractivityMode } from './router';

const RENDERED_IFRAME_SANDBOX = 'allow-same-origin' as const;

interface TemplateViewProps {
  brand: VbrandType;
  templateId: TemplateId;
  mode: InteractivityMode;
}

export function TemplateView({ brand, templateId, mode }: TemplateViewProps) {
  const template = TEMPLATE_REGISTRY[templateId];

  const [composition, setComposition] = useState(() => {
    const fromHash = compositionFromHash(window.location.hash);
    return compositionMatchesTemplate(fromHash, templateId)
      ? fromHash
      : template.defaultComposition();
  });

  const [content, setContent] = useState<ContentOverrideMap>(() => {
    return contentFromHash(window.location.hash) ?? {};
  });

  useEffect(() => {
    const compositionPart = encodeComposition(composition);
    const hasContent = Object.keys(content).length > 0;
    const hash = hasContent
      ? `#composition=${compositionPart}&${contentToHash(content)}`
      : `#composition=${compositionPart}`;
    history.replaceState(null, '', window.location.pathname + window.location.search + hash);
  }, [composition, content]);

  const prevTemplateRef = useRef<TemplateId>(templateId);

  useEffect(() => {
    if (prevTemplateRef.current === templateId) return;
    prevTemplateRef.current = templateId;
    setComposition((prev) =>
      compositionMatchesTemplate(prev, templateId)
        ? prev
        : template.defaultComposition(),
    );
    setContent({});
  }, [templateId]);

  function handleReset() {
    setComposition(template.defaultComposition());
    setContent({});
  }

  const tree = template.compose(brand, composition, content);

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
      <CompositionEditorDemo
        spec={composition}
        onChange={setComposition}
        onReset={handleReset}
      />
      <RenderArea tree={tree} mode={mode} />
      <ContentEditor
        brand={brand}
        templateId={templateId}
        content={content}
        onChange={setContent}
        onReset={() => setContent({})}
      />
    </div>
  );
}

interface RenderAreaProps {
  tree: React.ReactElement;
  mode: InteractivityMode;
}

function RenderArea({ tree, mode }: RenderAreaProps) {
  if (mode === 'static') {
    const html = staticRender(tree);
    return (
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column' }}>
        <ModeBadge mode="static" islandCount={0} />
        <iframe
          srcDoc={html}
          sandbox={RENDERED_IFRAME_SANDBOX}
          style={{ flex: 1, border: 'none', width: '100%' }}
          title="static render"
        />
      </div>
    );
  }

  if (mode === 'hybrid') {
    return <HybridRenderArea tree={tree} />;
  }

  return (
    <div style={{ flex: 1, overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column' }}>
      <ModeBadge mode="spa" islandCount={0} />
      <div style={{ flex: 1, overflow: 'auto' }}>
        {tree}
      </div>
    </div>
  );
}

function HybridRenderArea({ tree }: { tree: React.ReactElement }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const islandsRef = useRef<IslandManifest>([]);

  const { html, islands } = hybridRender(tree);
  islandsRef.current = islands;

  function handleLoad() {
    const doc = iframeRef.current?.contentDocument;
    if (!doc || islandsRef.current.length === 0) return;
    void hydrateIslands(islandsRef.current, () => null, doc);
  }

  return (
    <div style={{ flex: 1, overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column' }}>
      <ModeBadge mode="hybrid" islandCount={islands.length} />
      <iframe
        ref={iframeRef}
        srcDoc={html}
        sandbox={RENDERED_IFRAME_SANDBOX}
        onLoad={handleLoad}
        style={{ flex: 1, border: 'none', width: '100%' }}
        title="hybrid render"
      />
    </div>
  );
}

interface ModeBadgeProps {
  mode: InteractivityMode;
  islandCount: number;
}

const BADGE_LABEL: Record<InteractivityMode, string> = {
  static: 'static',
  hybrid: 'hybrid',
  spa: 'full hydration',
};

function ModeBadge({ mode, islandCount }: ModeBadgeProps) {
  const colors: Record<InteractivityMode, string> = {
    static: '#10b981',
    hybrid: '#f59e0b',
    spa: 'var(--color-primary, #6366f1)',
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: '8px',
        right: '8px',
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: 'rgba(0,0,0,0.75)',
        color: '#fff',
        borderRadius: '4px',
        padding: '4px 8px',
        fontSize: '0.6875rem',
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        fontFamily: 'system-ui, sans-serif',
        pointerEvents: 'none',
      }}
    >
      <span style={{ color: colors[mode] }}>{BADGE_LABEL[mode]}</span>
      {mode === 'hybrid' && (
        <span style={{ color: 'rgba(255,255,255,0.6)' }}>{islandCount} island{islandCount !== 1 ? 's' : ''}</span>
      )}
    </div>
  );
}
