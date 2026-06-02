// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
export type { AppTypeTemplate, ContentOverrideMap } from './types.js';
export { landingTemplate } from './landing.js';
export { marketingTemplate } from './marketing.js';
export { docsTemplate } from './docs.js';
export { dashboardTemplate } from './dashboard.js';
export {
  TEMPLATE_IDS,
  TEMPLATE_REGISTRY,
  getTemplate,
  isTemplateId,
  compositionMatchesTemplate,
} from './registry.js';
export type { TemplateId } from './registry.js';
