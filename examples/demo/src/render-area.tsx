// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import React, { useRef } from 'react';
import type { VbrandType } from '@booga/vbrand/adapters/browser';
import { getStackRuntime } from '@booga/vbrand/stacks';
import { staticRender, hybridRender, hydrateIslands } from '@booga/vbrand/interactivity';
import type { IslandManifest } from '@booga/vbrand/interactivity';
import type { InteractivityMode, StackName } from './router';
import { DEFAULT_STACK } from './router';

// allow-same-origin lets hydrateIslands reach iframe.contentDocument across frames;
// allow-scripts is deliberately absent so untrusted preview content cannot execute scripts in the same-origin context.
const RENDERED_IFRAME_SANDBOX = 'allow-same-origin' as const;
const ARTEFACT_PANEL_HEIGHT_PX = 220;

export interface RenderAreaProps {
  tree: React.ReactElement;
  mode: InteractivityMode;
  brand: VbrandType;
  stack: StackName;
  base: string;
}

export function RenderArea({ tree, mode, brand, stack, base }: RenderAreaProps) {
  if (stackIsExplicitInUrl() || stack !== DEFAULT_STACK) {
    return <StackArtefactView tree={tree} mode={mode} brand={brand} stack={stack} base={base} />;
  }
  return <LivePreviewArea tree={tree} mode={mode} brand={brand} showBadge />;
}

function stackIsExplicitInUrl(): boolean {
  return new URLSearchParams(window.location.search).has('stack');
}

interface StackArtefactViewProps {
  tree: React.ReactElement;
  mode: InteractivityMode;
  brand: VbrandType;
  stack: StackName;
  base: string;
}

function StackArtefactView({ tree, mode, brand, stack, base }: StackArtefactViewProps) {
  const defaultMode = getStackRuntime(stack).defaultMode();
  const islandCount = stack === 'astro' ? 1 : 0;

  return (
    <div
      data-render-surface={stack}
      style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}
    >
      <ModeBadge mode={defaultMode} islandCount={islandCount} />
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex' }}>
        <LivePreviewArea tree={tree} mode={mode} brand={brand} showBadge={false} />
      </div>
      <StackArtefactPanel stack={stack} base={base} />
    </div>
  );
}

export function stackArtefactUrl(base: string, stack: StackName): string {
  const normalBase = base.endsWith('/') ? base : `${base}/`;
  return `${normalBase}stacks/${stack}.html`;
}

interface StackArtefactPanelProps {
  stack: StackName;
  base: string;
}

function StackArtefactPanel({ stack, base }: StackArtefactPanelProps) {
  const stackMode = getStackRuntime(stack).defaultMode();
  const stackAccent = stackMode === 'static' ? '#22c55e' : stackMode === 'hybrid' ? '#eab308' : 'var(--color-primary, #6366f1)';
  return (
    <div style={{
      height: `${ARTEFACT_PANEL_HEIGHT_PX}px`,
      flexShrink: 0,
      borderTop: '2px solid var(--color-neutral-200, #e5e7eb)',
      background: 'var(--color-neutral-50, #f9fafb)',
      overflow: 'hidden',
      position: 'relative',
    }}>
      <div style={{
        position: 'absolute', top: '8px', left: '8px', zIndex: 1,
        display: 'flex', alignItems: 'center', gap: '4px',
        background: 'var(--color-neutral-700, #374151)', border: `1px solid ${stackAccent}`,
        borderRadius: '4px', padding: '4px 8px',
        fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
        fontFamily: 'system-ui, sans-serif', pointerEvents: 'none',
      }}>
        <span style={{ color: 'var(--color-neutral-400, #9ca3af)' }}>emit-shape</span>
        <span style={{ color: stackAccent }}>{stack}</span>
      </div>
      <iframe
        data-stack-preview={stack}
        src={stackArtefactUrl(base, stack)}
        sandbox={RENDERED_IFRAME_SANDBOX}
        style={{ width: '100%', height: '100%', border: 'none' }}
        title={`${stack} stack preview`}
      />
    </div>
  );
}

interface LivePreviewAreaProps {
  tree: React.ReactElement;
  mode: InteractivityMode;
  brand: VbrandType;
  showBadge: boolean;
}

function LivePreviewArea({ tree, mode, brand, showBadge }: LivePreviewAreaProps) {
  if (mode === 'static') {
    const srcDoc = staticRender({ brand, sections: [tree] });
    return (
      <div
        data-render-surface="static"
        style={{ flex: 1, overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column' }}
      >
        {showBadge && <ModeBadge mode="static" islandCount={0} />}
        <iframe
          srcDoc={srcDoc}
          sandbox={RENDERED_IFRAME_SANDBOX}
          style={{ flex: 1, border: 'none', width: '100%' }}
          title="static render"
        />
      </div>
    );
  }

  if (mode === 'hybrid') {
    return <HybridRenderArea tree={tree} brand={brand} showBadge={showBadge} />;
  }

  return (
    <div
      data-render-surface="spa"
      style={{ flex: 1, overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column' }}
    >
      {showBadge && <ModeBadge mode="spa" islandCount={0} />}
      <div data-preview-content style={{ flex: 1, overflow: 'auto' }}>
        {tree}
      </div>
    </div>
  );
}

interface HybridRenderAreaProps {
  tree: React.ReactElement;
  brand: VbrandType;
  showBadge: boolean;
}

function HybridRenderArea({ tree, brand, showBadge }: HybridRenderAreaProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const islandsRef = useRef<IslandManifest>([]);
  const getIslandComponentRef = useRef<(id: string) => React.ReactNode>(() => null);

  const { html, islands, getIslandComponent } = hybridRender({ brand, sections: [tree] });
  islandsRef.current = islands;
  getIslandComponentRef.current = getIslandComponent;

  function handleLoad() {
    const doc = iframeRef.current?.contentDocument;
    if (!doc || islandsRef.current.length === 0) return;
    void hydrateIslands(islandsRef.current, getIslandComponentRef.current, doc);
  }

  return (
    <div
      data-render-surface="hybrid"
      style={{ flex: 1, overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column' }}
    >
      {showBadge && <ModeBadge mode="hybrid" islandCount={islands.length} />}
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

const BADGE_COLORS: Record<InteractivityMode, string> = {
  static: '#22c55e',
  hybrid: '#eab308',
  spa: 'var(--color-primary, #6366f1)',
};

const BADGE_LABEL: Record<InteractivityMode, string> = {
  static: 'static',
  hybrid: 'hybrid',
  spa: 'SPA preview',
};

interface ModeBadgeProps {
  mode: InteractivityMode;
  islandCount: number;
}

function ModeBadge({ mode, islandCount }: ModeBadgeProps) {
  return (
    <div style={{
      position: 'absolute', top: '8px', right: '8px', zIndex: 10,
      display: 'flex', alignItems: 'center', gap: '8px',
      background: 'var(--color-neutral-700, #374151)', border: `1px solid ${BADGE_COLORS[mode]}`,
      color: '#fff', borderRadius: '4px', padding: '4px 8px',
      fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
      fontFamily: 'system-ui, sans-serif', pointerEvents: 'none',
    }}>
      <span style={{ color: BADGE_COLORS[mode] }}>{BADGE_LABEL[mode]}</span>
      {mode === 'hybrid' && (
        <span style={{ color: 'var(--color-neutral-400, #9ca3af)' }}>
          {islandCount} island{islandCount !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  );
}
