// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { landingTemplate } from './landing.js';
import { marketingTemplate } from './marketing.js';
import { docsTemplate } from './docs.js';
import { dashboardTemplate } from './dashboard.js';
import type { AppTypeTemplate } from './types.js';

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
