// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { landingTemplate } from './landing.js';
import { marketingTemplate } from './marketing.js';
import { docsTemplate } from './docs.js';
import { dashboardTemplate } from './dashboard.js';
import type { AppTypeTemplate } from './types.js';
import type { CompositionSpec } from '../composition/spec.js';

export const TEMPLATE_IDS = ['landing', 'marketing', 'docs', 'dashboard'] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

export const TEMPLATE_REGISTRY: Readonly<Record<TemplateId, AppTypeTemplate>> = {
  landing: landingTemplate,
  marketing: marketingTemplate,
  docs: docsTemplate,
  dashboard: dashboardTemplate,
};

export function getTemplate(id: TemplateId): AppTypeTemplate {
  return TEMPLATE_REGISTRY[id];
}

export function isTemplateId(value: string): value is TemplateId {
  return (TEMPLATE_IDS as readonly string[]).includes(value);
}

export function compositionMatchesTemplate(
  comp: CompositionSpec | null,
  templateId: TemplateId,
): comp is CompositionSpec {
  if (comp === null || comp.sections.length === 0) return false;
  const templateSectionIds = new Set(
    TEMPLATE_REGISTRY[templateId].defaultComposition().sections.map((s) => s.id),
  );
  const compSectionIds = new Set(comp.sections.map((s) => s.id));
  return (
    comp.sections.length === compSectionIds.size &&
    compSectionIds.size === templateSectionIds.size &&
    [...compSectionIds].every((id) => templateSectionIds.has(id))
  );
}
