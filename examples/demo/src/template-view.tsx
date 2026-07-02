// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import React from 'react';
import type { VbrandType } from '@booga/vbrand/adapters/browser';
import { TEMPLATE_REGISTRY } from '@booga/vbrand/templates';
import type { ContentOverrideMap } from '@booga/vbrand/content';
import { CompositionEditorDemo } from './composition-editor-demo';
import { ContentEditor } from './content-editor';
import { useCmsContent } from './use-cms-content';
import { useComposition } from './use-composition';
import { mergeContentLayers } from './content-layers';
import { useBreakpoint } from './use-breakpoint';
import { deriveLayout } from './demo-layout-styles';
import { AxisLedger } from './axis-ledger';
import { RenderArea } from './render-area';
import { StackToggle } from './stack-toggle';
import { CmsToggle } from './cms-toggle';
import { DeployInfo } from './deploy-info';
import { deriveTargetMode } from '@booga/vbrand/stacks';
import type { TemplateId, InteractivityMode, StackName, CmsName } from './router';
import { buildSearchString } from './router';

export interface TemplateViewProps {
  brand: VbrandType;
  templateId: TemplateId;
  mode: InteractivityMode;
  stack: StackName;
  cms: CmsName;
  brandLabel: string;
  fixtureSlug: string | undefined;
  base: string;
}

export function TemplateView({
  brand, templateId, mode, stack, cms, brandLabel, fixtureSlug, base,
}: TemplateViewProps) {
  const { composition, setComposition, handleReset, userContent, setUserContent } = useComposition(templateId);
  const cmsContent = useCmsContent(cms, fixtureSlug);
  const content: ContentOverrideMap = mergeContentLayers(cmsContent, userContent);

  const template = TEMPLATE_REGISTRY[templateId];
  const tree = template.compose(brand, composition, content);
  const layout = deriveLayout(useBreakpoint());

  function applyAxis(nextStack: StackName, nextCms: CmsName) {
    const nextMode = deriveTargetMode(mode, stack, nextStack);
    window.location.search = buildSearchString(brandLabel, templateId, nextMode, nextStack, nextCms);
  }

  return (
    <div style={layout.outer}>
      <div style={layout.composition}>
        <CompositionEditorDemo spec={composition} onChange={setComposition} onReset={handleReset} />
      </div>
      <div style={layout.preview}>
        <RenderArea tree={tree} mode={mode} brand={brand} stack={stack} base={base} />
      </div>
      <div style={layout.operations}>
        <AxisLedger stack={stack} cms={cms} />
        <StackToggle stack={stack} onChange={(next) => applyAxis(next, cms)} />
        <CmsToggle cms={cms} onChange={(next) => applyAxis(stack, next)} />
        <DeployInfo />
        <div style={{ minWidth: 0 }}>
          <ContentEditor
            brand={brand}
            templateId={templateId}
            content={content}
            onChange={setUserContent}
            onReset={() => setUserContent({})}
          />
        </div>
      </div>
    </div>
  );
}
