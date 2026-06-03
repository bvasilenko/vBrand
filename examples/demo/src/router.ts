// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
export type TemplateId = 'landing' | 'marketing' | 'docs' | 'dashboard';
export type InteractivityMode = 'static' | 'hybrid' | 'spa';

export type BrandParams =
  | { type: 'fixture'; handle: string }
  | { type: 'url'; url: string }
  | { type: 'github'; owner: string; repo: string }
  | { type: 'npm'; pkg: string }
  | { type: 'json'; payload: unknown }
  | { type: 'parse-error'; raw: string; reason: string };

export type ViewTab = 'template' | 'data';

export interface RouteState {
  brandParams: BrandParams;
  templateId: TemplateId;
  view: ViewTab;
  mode: InteractivityMode;
}

const TEMPLATE_IDS: readonly TemplateId[] = ['landing', 'marketing', 'docs', 'dashboard'];
const INTERACTION_MODES: readonly InteractivityMode[] = ['static', 'hybrid', 'spa'];
const DEFAULT_BRAND: BrandParams = { type: 'fixture', handle: 'stripe' };
const DEFAULT_TEMPLATE: TemplateId = 'landing';
export const DEFAULT_MODE: InteractivityMode = 'spa';

export function parseRoute(search: string, pathname = '/', base = '/'): RouteState {
  const params = new URLSearchParams(search);
  return {
    brandParams: parseBrandParam(params.get('brand')),
    templateId: parseTemplateParam(params.get('app')),
    view: parseViewFromPath(pathname, base),
    mode: parseModeParam(params.get('mode')),
  };
}

export function parseViewFromPath(pathname: string, base = '/'): ViewTab {
  const stripped = pathname.replace(/\/+$/, '');
  const baseStripped = base.replace(/\/+$/, '') || '/';

  if (baseStripped !== '/') {
    if (stripped.startsWith(baseStripped)) {
      const relative = stripped.slice(baseStripped.length);
      return relative === '/data' || relative === 'data' ? 'data' : 'template';
    }
    return 'template';
  }

  return stripped === '/data' || stripped.endsWith('/data') ? 'data' : 'template';
}

export function buildViewPath(view: ViewTab, base = '/'): string {
  const normalBase = base.endsWith('/') ? base : `${base}/`;
  return view === 'data' ? `${normalBase}data` : normalBase;
}

export function buildSearchString(
  brandParam: string,
  templateId: TemplateId,
  mode?: InteractivityMode,
): string {
  const params = new URLSearchParams();
  if (brandParam) params.set('brand', brandParam);
  params.set('app', templateId);
  if (mode && mode !== DEFAULT_MODE) params.set('mode', mode);
  return params.toString();
}

export function brandParamToString(params: BrandParams): string {
  switch (params.type) {
    case 'fixture':     return `fixture:${params.handle}`;
    case 'url':         return params.url;
    case 'github':      return `github:${params.owner}/${params.repo}`;
    case 'npm':         return `npm:${params.pkg}`;
    case 'json':        return `json:${btoa(JSON.stringify(params.payload))}`;
    case 'parse-error': return params.raw;
  }
}

function parseBrandParam(raw: string | null): BrandParams {
  if (!raw) return DEFAULT_BRAND;

  if (raw.startsWith('fixture:')) {
    const handle = raw.slice(8).trim();
    return handle ? { type: 'fixture', handle } : DEFAULT_BRAND;
  }

  if (raw.startsWith('github:')) {
    const parts = raw.slice(7).split('/');
    const owner = parts[0]?.trim();
    const repo = parts.slice(1).join('/').trim();
    return owner && repo ? { type: 'github', owner, repo } : DEFAULT_BRAND;
  }

  if (raw.startsWith('npm:')) {
    const pkg = raw.slice(4).trim();
    return pkg ? { type: 'npm', pkg } : DEFAULT_BRAND;
  }

  if (raw.startsWith('json:')) {
    return parseJsonParam(raw, raw.slice(5));
  }

  try {
    new URL(raw);
    return { type: 'url', url: raw };
  } catch {
    return DEFAULT_BRAND;
  }
}

function parseJsonParam(raw: string, encoded: string): BrandParams {
  try {
    return { type: 'json', payload: JSON.parse(atob(encoded)) };
  } catch {
    return {
      type: 'parse-error',
      raw,
      reason: `json: value must be base64-encoded JSON. Example: json:${btoa('{"name":"example"}')}`,
    };
  }
}

function parseTemplateParam(raw: string | null): TemplateId {
  if (raw && (TEMPLATE_IDS as readonly string[]).includes(raw)) {
    return raw as TemplateId;
  }
  return DEFAULT_TEMPLATE;
}

function parseModeParam(raw: string | null): InteractivityMode {
  if (raw && (INTERACTION_MODES as readonly string[]).includes(raw)) {
    return raw as InteractivityMode;
  }
  return DEFAULT_MODE;
}
