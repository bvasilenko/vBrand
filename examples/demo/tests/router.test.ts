// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { describe, it, expect } from 'vitest';
import {
  parseRoute,
  parseViewFromPath,
  buildViewPath,
  buildSearchString,
  brandParamToString,
  type BrandParams,
  type InteractivityMode,
  type StackName,
  type CmsName,
  DEFAULT_MODE,
  DEFAULT_STACK,
  DEFAULT_CMS,
  type TemplateId,
} from '../src/router.js';

const DEFAULT_BRAND: BrandParams = { type: 'fixture', handle: 'stripe' };
const ALL_TEMPLATE_IDS: readonly TemplateId[] = ['landing', 'marketing', 'docs', 'dashboard'];

const JSON_PARSEABLE_INPUTS: ReadonlyArray<[label: string, brand: string, payload: unknown]> = [
  [
    'base64-encoded JSON object',
    `json:${btoa(JSON.stringify({ name: 'acme', version: 1 }))}`,
    { name: 'acme', version: 1 },
  ],
  [
    'base64-encoded JSON array',
    `json:${btoa(JSON.stringify([1, 2, 3]))}`,
    [1, 2, 3],
  ],
  [
    'base64-encoded JSON number',
    `json:${btoa(JSON.stringify(42))}`,
    42,
  ],
  [
    'base64-encoded JSON string',
    `json:${btoa(JSON.stringify('hello'))}`,
    'hello',
  ],
  [
    'base64-encoded JSON true',
    `json:${btoa(JSON.stringify(true))}`,
    true,
  ],
  [
    'base64-encoded JSON false',
    `json:${btoa(JSON.stringify(false))}`,
    false,
  ],
  [
    'base64-encoded JSON null',
    `json:${btoa(JSON.stringify(null))}`,
    null,
  ],
];

const JSON_UNPARSEABLE_INPUTS: ReadonlyArray<[label: string, brand: string]> = [
  ['empty json: suffix', 'json:'],
  ['whitespace-only suffix', 'json: '],
  ['valid base64 of syntactically invalid JSON', `json:${btoa('{not json}')}`],
  ['payload that is neither valid base64 nor valid JSON', 'json:not-json-or-base64!!!'],
  ['raw JSON object (requires base64 encoding for URL safety)', `json:${JSON.stringify({ name: 'acme' })}`],
  ['raw JSON array (requires base64 encoding)', `json:${JSON.stringify([1, 2])}`],
  ['raw JSON number (requires base64 encoding)', 'json:42'],
  ['raw JSON string (requires base64 encoding)', 'json:"hello"'],
  ['raw JSON null literal (requires base64 encoding)', 'json:null'],
  ['raw JSON boolean literal (requires base64 encoding)', 'json:true'],
];

const VALID_BRAND_PARAMS: ReadonlyArray<[label: string, params: BrandParams]> = [
  ['fixture', { type: 'fixture', handle: 'vercel' }],
  ['url',     { type: 'url', url: 'https://stripe.com' }],
  ['github',  { type: 'github', owner: 'vercel', repo: 'next.js' }],
  ['npm',     { type: 'npm', pkg: 'react' }],
  ['json',    { type: 'json', payload: { version: 1 } }],
];

describe('parseRoute - brand param: fixture prefix', () => {
  it.each(['stripe', 'vercel', 'linear', 'notion', 'github'] as const)(
    'fixture:%s → type:fixture preserving the handle verbatim',
    (handle) => {
      expect(parseRoute(`brand=fixture:${handle}`).brandParams).toEqual({ type: 'fixture', handle });
    },
  );

  it.each(['', '   '] as const)(
    'fixture:"%s" (empty or whitespace handle) falls back to default brand',
    (suffix) => {
      expect(parseRoute(`brand=fixture:${suffix}`).brandParams).toEqual(DEFAULT_BRAND);
    },
  );
});

describe('parseRoute - brand param: github prefix', () => {
  it('github:owner/repo → type:github with correct owner and repo', () => {
    expect(parseRoute('brand=github:stripe/stripe-js').brandParams).toEqual(
      { type: 'github', owner: 'stripe', repo: 'stripe-js' },
    );
  });

  it('github:owner/repo/sub treats everything after the first slash as the repo', () => {
    expect(parseRoute('brand=github:owner/repo/sub').brandParams).toEqual(
      { type: 'github', owner: 'owner', repo: 'repo/sub' },
    );
  });

  it.each(['', 'stripe/', '/stripe-js', 'stripe'] as const)(
    'github:%s (missing owner, repo, or separator) falls back to default brand',
    (suffix) => {
      expect(parseRoute(`brand=github:${suffix}`).brandParams).toEqual(DEFAULT_BRAND);
    },
  );
});

describe('parseRoute - brand param: npm prefix', () => {
  it('npm:pkg → type:npm preserving the package name verbatim', () => {
    expect(parseRoute('brand=npm:react').brandParams).toEqual({ type: 'npm', pkg: 'react' });
  });

  it('npm:@scope/pkg preserves the full scoped package name', () => {
    expect(parseRoute('brand=npm:@scope/pkg').brandParams).toEqual({ type: 'npm', pkg: '@scope/pkg' });
  });

  it.each(['', '   '] as const)(
    'npm:"%s" (empty or whitespace package name) falls back to default brand',
    (suffix) => {
      expect(parseRoute(`brand=npm:${suffix}`).brandParams).toEqual(DEFAULT_BRAND);
    },
  );
});

describe('parseRoute - brand param: json prefix - accepted encodings', () => {
  it.each(JSON_PARSEABLE_INPUTS)('%s → type:json with correct payload', (_, brand, payload) => {
    expect(parseRoute(`brand=${brand}`).brandParams).toEqual({ type: 'json', payload });
  });
});

describe('parseRoute - brand param: json prefix - encoding requirement', () => {
  it.each(JSON_UNPARSEABLE_INPUTS)('%s → type is parse-error', (_, brand) => {
    expect(parseRoute(`brand=${brand}`).brandParams.type).toBe('parse-error');
  });
});

describe('parseRoute - brand param: json prefix - parse-error structural contract', () => {
  it.each(JSON_UNPARSEABLE_INPUTS)(
    '%s → raw field matches input, reason instructs base64 usage, serializes back to input',
    (_, brand) => {
      const result = parseRoute(`brand=${brand}`).brandParams;
      expect(result.type).toBe('parse-error');
      if (result.type !== 'parse-error') return;
      expect(result.raw).toBe(brand);
      expect(result.reason).toMatch(/json:/);
      expect(brandParamToString(result)).toBe(brand);
    },
  );

  it('reason string embeds a self-validating json: example that itself parses successfully', () => {
    const result = parseRoute('brand=json:not-valid').brandParams;
    expect(result.type).toBe('parse-error');
    if (result.type !== 'parse-error') return;
    const exampleMatch = result.reason.match(/(json:\S+)/);
    expect(exampleMatch).not.toBeNull();
    if (!exampleMatch) return;
    expect(parseRoute(`brand=${exampleMatch[1]}`).brandParams.type).toBe('json');
  });
});

describe('parseRoute - brand param: URL and unrecognized inputs', () => {
  it.each(['https://stripe.com', 'http://example.com'] as const)(
    '%s → type:url with the URL string preserved verbatim',
    (url) => {
      expect(parseRoute(`brand=${url}`).brandParams).toEqual({ type: 'url', url });
    },
  );

  it('unrecognized string (no known prefix, not a URL) falls back to default brand', () => {
    expect(parseRoute('brand=not-a-url').brandParams).toEqual(DEFAULT_BRAND);
  });

  it('absent brand param falls back to default brand', () => {
    expect(parseRoute('app=landing').brandParams).toEqual(DEFAULT_BRAND);
  });

  it('empty search string falls back to default brand and default template simultaneously', () => {
    const result = parseRoute('');
    expect(result.brandParams).toEqual(DEFAULT_BRAND);
    expect(result.templateId).toBe('landing');
  });
});

describe('parseRoute - templateId parsing', () => {
  it.each(ALL_TEMPLATE_IDS)('app=%s is accepted as a valid templateId', (id) => {
    expect(parseRoute(`app=${id}`).templateId).toBe(id);
  });

  it.each(['', 'unknown-template', 'LANDING'] as const)(
    'app="%s" (absent, unrecognized, or wrong case) falls back to landing',
    (val) => {
      expect(parseRoute(`app=${val}`).templateId).toBe('landing');
    },
  );

  it('absent app param falls back to landing when a valid brand is present', () => {
    expect(parseRoute('brand=fixture:stripe').templateId).toBe('landing');
  });
});

describe('brandParamToString - serialization contract', () => {
  it('fixture params serialize as fixture:handle', () => {
    expect(brandParamToString({ type: 'fixture', handle: 'stripe' })).toBe('fixture:stripe');
  });

  it('url params serialize to the URL string verbatim', () => {
    expect(brandParamToString({ type: 'url', url: 'https://stripe.com' })).toBe('https://stripe.com');
  });

  it('github params serialize as github:owner/repo', () => {
    expect(brandParamToString({ type: 'github', owner: 'stripe', repo: 'stripe-js' })).toBe(
      'github:stripe/stripe-js',
    );
  });

  it('npm params serialize as npm:pkg', () => {
    expect(brandParamToString({ type: 'npm', pkg: 'react' })).toBe('npm:react');
  });

  it('json params serialize as json:base64 with a payload recoverable by JSON.parse(atob(...))', () => {
    const payload = { name: 'acme' };
    const str = brandParamToString({ type: 'json', payload });
    expect(str).toMatch(/^json:/);
    expect(JSON.parse(atob(str.slice(5)))).toEqual(payload);
  });

  it('parse-error params serialize to the raw field regardless of the reason content', () => {
    const params: BrandParams = { type: 'parse-error', raw: 'json:arbitrary', reason: 'any text' };
    expect(brandParamToString(params)).toBe(params.raw);
  });

  it.each(VALID_BRAND_PARAMS)(
    '%s params: output is always a non-empty string',
    (_, params) => {
      expect(brandParamToString(params).length).toBeGreaterThan(0);
    },
  );
});

describe('buildSearchString - query string construction', () => {
  it.each(ALL_TEMPLATE_IDS)('produces app=%s for every known template ID', (id) => {
    expect(new URLSearchParams(buildSearchString('fixture:stripe', id)).get('app')).toBe(id);
  });

  it('includes the brand parameter when a non-empty brand string is given', () => {
    const result = new URLSearchParams(buildSearchString('fixture:stripe', 'landing'));
    expect(result.get('brand')).toBe('fixture:stripe');
  });

  it('omits the brand parameter entirely when brandParam is an empty string', () => {
    expect(new URLSearchParams(buildSearchString('', 'landing')).get('brand')).toBeNull();
  });

  it('output is parseable by parseRoute and recovers both brand and template', () => {
    const result = parseRoute(buildSearchString('fixture:vercel', 'marketing'));
    expect(result.brandParams).toEqual({ type: 'fixture', handle: 'vercel' });
    expect(result.templateId).toBe('marketing');
  });
});

describe('parseRoute + brandParamToString - round-trip for all valid param types', () => {
  it.each(VALID_BRAND_PARAMS)(
    '%s: brandParamToString → buildSearchString → parseRoute recovers the original params',
    (_, params) => {
      const str = brandParamToString(params);
      const search = buildSearchString(str, 'landing');
      expect(parseRoute(search).brandParams).toEqual(params);
    },
  );
});

describe('parseViewFromPath - data path detection', () => {
  it('returns "data" for /vBrand/data when base is /vBrand/', () => {
    expect(parseViewFromPath('/vBrand/data', '/vBrand/')).toBe('data');
  });

  it('returns "template" for /vBrand/ when base is /vBrand/', () => {
    expect(parseViewFromPath('/vBrand/', '/vBrand/')).toBe('template');
  });

  it('returns "template" for /vBrand/random-path', () => {
    expect(parseViewFromPath('/vBrand/random-path', '/vBrand/')).toBe('template');
  });

  it('returns "data" for /data when base is /', () => {
    expect(parseViewFromPath('/data', '/')).toBe('data');
  });

  it('returns "template" for / when base is /', () => {
    expect(parseViewFromPath('/', '/')).toBe('template');
  });

  it('returns "data" for /vBrand/data/ with trailing slash', () => {
    expect(parseViewFromPath('/vBrand/data/', '/vBrand/')).toBe('data');
  });

  it('does not match /vBrand/update-data as data view', () => {
    expect(parseViewFromPath('/vBrand/update-data', '/vBrand/')).toBe('template');
  });

  it('deep nested path maps to "template" (SPA fallback: all sub-routes serve the shell)', () => {
    expect(parseViewFromPath('/vBrand/settings/deep/nested', '/vBrand/')).toBe('template');
  });
});

describe('parseRoute - view field integration', () => {
  it('returns view "data" when pathname is /vBrand/data', () => {
    expect(parseRoute('?app=landing', '/vBrand/data').view).toBe('data');
  });

  it('returns view "template" when pathname is /vBrand/', () => {
    expect(parseRoute('?app=landing', '/vBrand/').view).toBe('template');
  });

  it('returns view "template" for unknown paths (SPA shell fallback)', () => {
    expect(parseRoute('?', '/vBrand/random-path').view).toBe('template');
  });

  it('returns view "template" when no pathname provided (default)', () => {
    expect(parseRoute('brand=fixture:stripe').view).toBe('template');
  });
});

describe('buildViewPath - constructs correct URL path for each view', () => {
  it('template view with /vBrand/ base returns /vBrand/', () => {
    expect(buildViewPath('template', '/vBrand/')).toBe('/vBrand/');
  });

  it('data view with /vBrand/ base returns /vBrand/data', () => {
    expect(buildViewPath('data', '/vBrand/')).toBe('/vBrand/data');
  });

  it('template view with / base returns /', () => {
    expect(buildViewPath('template', '/')).toBe('/');
  });

  it('data view with / base returns /data', () => {
    expect(buildViewPath('data', '/')).toBe('/data');
  });
});

const ALL_MODES: readonly InteractivityMode[] = ['static', 'hybrid', 'spa'];
const ALL_STACKS: readonly StackName[] = ['vite', 'next', 'astro'];
const ALL_CMS: readonly CmsName[] = ['vbrand-standalone', 'payload', 'sanity', 'strapi'];
const STACK_DEFAULT_MODES: Record<StackName, InteractivityMode> = { vite: 'spa', next: 'hybrid', astro: 'static' };

describe('parseRoute - mode field parsing', () => {
  it.each(ALL_MODES)('mode=%s is parsed as InteractivityMode %s', (mode) => {
    expect(parseRoute(`app=landing&mode=${mode}`).mode).toBe(mode);
  });

  it.each(['ssr', '', 'SSR', 'Static'] as const)(
    'unrecognized mode value "%s" falls back to DEFAULT_MODE',
    (bad) => {
      expect(parseRoute(`app=landing&mode=${bad}`).mode).toBe(DEFAULT_MODE);
    },
  );

  it('mode field is independent of brand and template params', () => {
    const route = parseRoute('brand=fixture:stripe&app=marketing&mode=static');
    expect(route.mode).toBe('static');
    expect(route.templateId).toBe('marketing');
    expect(route.brandParams).toEqual({ type: 'fixture', handle: 'stripe' });
  });

  it('all three modes survive parseRoute + parseRoute round-trip via buildSearchString', () => {
    for (const mode of ALL_MODES) {
      const search = buildSearchString('fixture:stripe', 'landing', mode);
      expect(parseRoute(search).mode).toBe(mode);
    }
  });
});

describe('parseRoute - mode derives from stack default when mode param is absent', () => {
  it.each(ALL_STACKS)(
    'absent mode + stack=%s yields the declared stack default mode',
    (stack) => {
      expect(parseRoute(`app=landing&stack=${stack}`).mode).toBe(STACK_DEFAULT_MODES[stack]);
    },
  );

  it('absent mode and absent stack param yields the DEFAULT_STACK default mode', () => {
    expect(parseRoute('app=landing').mode).toBe(STACK_DEFAULT_MODES[DEFAULT_STACK]);
  });

  it.each(ALL_STACKS.flatMap((stack) => ALL_MODES.map((mode) => [stack, mode] as const)))(
    'stack=%s with explicit mode=%s is always honoured regardless of stack default',
    (stack, mode) => {
      expect(parseRoute(`app=landing&stack=${stack}&mode=${mode}`).mode).toBe(mode);
    },
  );

  it.each(ALL_STACKS)(
    'unrecognized mode value on stack=%s falls back to DEFAULT_MODE',
    (stack) => {
      expect(parseRoute(`app=landing&stack=${stack}&mode=ssr`).mode).toBe(DEFAULT_MODE);
    },
  );
});

describe('buildSearchString - mode param encoding', () => {
  it('omitting the mode arg produces the same string as passing DEFAULT_MODE explicitly', () => {
    expect(buildSearchString('fixture:stripe', 'landing')).toBe(
      buildSearchString('fixture:stripe', 'landing', DEFAULT_MODE),
    );
  });

  it.each(ALL_STACKS)(
    'stack default mode for stack=%s is omitted from the query string (clean URL convention)',
    (stack) => {
      const params = new URLSearchParams(
        buildSearchString('fixture:stripe', 'landing', STACK_DEFAULT_MODES[stack], stack),
      );
      expect(params.get('mode')).toBeNull();
    },
  );

  it.each(
    ALL_STACKS.flatMap((stack) =>
      ALL_MODES.filter((mode) => mode !== STACK_DEFAULT_MODES[stack]).map((mode) => [stack, mode] as const),
    ),
  )(
    'non-default mode=%s on stack=%s is encoded in the query string',
    (stack, mode) => {
      const params = new URLSearchParams(buildSearchString('fixture:stripe', 'landing', mode, stack));
      expect(params.get('mode')).toBe(mode);
    },
  );

  it.each(ALL_STACKS.flatMap((stack) => ALL_MODES.map((mode) => [stack, mode] as const)))(
    'mode=%s on stack=%s survives buildSearchString → parseRoute round-trip',
    (stack, mode) => {
      const route = parseRoute(buildSearchString('fixture:vercel', 'docs', mode, stack));
      expect(route.mode).toBe(mode);
      expect(route.stack).toBe(stack);
    },
  );

  it.each(ALL_TEMPLATE_IDS)(
    'mode=static with template=%s round-trips correctly for all templates',
    (templateId) => {
      const route = parseRoute(buildSearchString('fixture:stripe', templateId, 'static'));
      expect(route.mode).toBe('static');
      expect(route.templateId).toBe(templateId);
    },
  );
});

describe('parseRoute - stack param parsing', () => {
  it.each(ALL_STACKS)('stack=%s is parsed as StackName %s', (stack) => {
    expect(parseRoute(`app=landing&stack=${stack}`).stack).toBe(stack);
  });

  it('absent stack param produces DEFAULT_STACK', () => {
    expect(parseRoute('app=landing').stack).toBe(DEFAULT_STACK);
  });

  it.each(['remix', '', 'VITE', 'Next'] as const)(
    'unrecognized or wrong-case stack value "%s" falls back to DEFAULT_STACK',
    (bad) => {
      expect(parseRoute(`app=landing&stack=${bad}`).stack).toBe(DEFAULT_STACK);
    },
  );

  it('stack field is independent of brand, template, mode, and cms params', () => {
    const route = parseRoute('brand=fixture:stripe&app=marketing&mode=static&stack=astro&cms=sanity');
    expect(route.stack).toBe('astro');
    expect(route.cms).toBe('sanity');
    expect(route.mode).toBe('static');
    expect(route.templateId).toBe('marketing');
  });

  it('all three stack values survive parseRoute round-trip via buildSearchString', () => {
    for (const stack of ALL_STACKS) {
      const search = buildSearchString('fixture:stripe', 'landing', undefined, stack);
      expect(parseRoute(search).stack).toBe(stack);
    }
  });
});

describe('parseRoute - cms param parsing', () => {
  it.each(ALL_CMS)('cms=%s is parsed as CmsName %s', (cms) => {
    expect(parseRoute(`app=landing&cms=${cms}`).cms).toBe(cms);
  });

  it('absent cms param produces DEFAULT_CMS', () => {
    expect(parseRoute('app=landing').cms).toBe(DEFAULT_CMS);
  });

  it.each(['wordpress', '', 'SANITY', 'Payload'] as const)(
    'unrecognized or wrong-case cms value "%s" falls back to DEFAULT_CMS',
    (bad) => {
      expect(parseRoute(`app=landing&cms=${bad}`).cms).toBe(DEFAULT_CMS);
    },
  );

  it('cms field is independent of brand, template, mode, and stack params', () => {
    const route = parseRoute('brand=fixture:vercel&app=docs&mode=hybrid&stack=next&cms=payload');
    expect(route.cms).toBe('payload');
    expect(route.stack).toBe('next');
    expect(route.mode).toBe('hybrid');
    expect(route.templateId).toBe('docs');
  });

  it('all four CMS values survive parseRoute round-trip via buildSearchString', () => {
    for (const cms of ALL_CMS) {
      const search = buildSearchString('fixture:stripe', 'landing', undefined, undefined, cms);
      expect(parseRoute(search).cms).toBe(cms);
    }
  });
});

describe('buildSearchString - stack and cms param encoding', () => {
  it('stack=vite (DEFAULT_STACK) is omitted from output for clean URL convention', () => {
    const params = new URLSearchParams(buildSearchString('fixture:stripe', 'landing', undefined, 'vite'));
    expect(params.get('stack')).toBeNull();
  });

  it('stack=next is encoded as stack=next in the query string', () => {
    const params = new URLSearchParams(buildSearchString('fixture:stripe', 'landing', undefined, 'next'));
    expect(params.get('stack')).toBe('next');
  });

  it('stack=astro is encoded as stack=astro in the query string', () => {
    const params = new URLSearchParams(buildSearchString('fixture:stripe', 'landing', undefined, 'astro'));
    expect(params.get('stack')).toBe('astro');
  });

  it('cms=vbrand-standalone (DEFAULT_CMS) is omitted from output for clean URL convention', () => {
    const params = new URLSearchParams(buildSearchString('fixture:stripe', 'landing', undefined, undefined, 'vbrand-standalone'));
    expect(params.get('cms')).toBeNull();
  });

  it('cms=payload is encoded as cms=payload in the query string', () => {
    const params = new URLSearchParams(buildSearchString('fixture:stripe', 'landing', undefined, undefined, 'payload'));
    expect(params.get('cms')).toBe('payload');
  });

  it('cms=sanity is encoded as cms=sanity in the query string', () => {
    const params = new URLSearchParams(buildSearchString('fixture:stripe', 'landing', undefined, undefined, 'sanity'));
    expect(params.get('cms')).toBe('sanity');
  });

  it('cms=strapi is encoded as cms=strapi in the query string', () => {
    const params = new URLSearchParams(buildSearchString('fixture:stripe', 'landing', undefined, undefined, 'strapi'));
    expect(params.get('cms')).toBe('strapi');
  });

  it('omitting stack arg produces the same string as passing DEFAULT_STACK explicitly', () => {
    expect(buildSearchString('fixture:stripe', 'landing', undefined, 'vite')).toBe(
      buildSearchString('fixture:stripe', 'landing'),
    );
  });

  it('omitting cms arg produces the same string as passing DEFAULT_CMS explicitly', () => {
    expect(buildSearchString('fixture:stripe', 'landing', undefined, undefined, 'vbrand-standalone')).toBe(
      buildSearchString('fixture:stripe', 'landing'),
    );
  });

  it.each(ALL_STACKS)('stack=%s round-trips through buildSearchString -> parseRoute', (stack) => {
    const route = parseRoute(buildSearchString('fixture:vercel', 'docs', undefined, stack));
    expect(route.stack).toBe(stack);
    expect(route.templateId).toBe('docs');
  });

  it.each(ALL_CMS)('cms=%s round-trips through buildSearchString -> parseRoute', (cms) => {
    const route = parseRoute(buildSearchString('fixture:vercel', 'docs', undefined, undefined, cms));
    expect(route.cms).toBe(cms);
    expect(route.templateId).toBe('docs');
  });
});

describe('parseRoute + buildSearchString - 5-axis URL round-trip', () => {
  it('all five axes survive a full round-trip through buildSearchString -> parseRoute', () => {
    const search = buildSearchString('fixture:stripe', 'marketing', 'static', 'astro', 'sanity');
    const route = parseRoute(search);
    expect(route.brandParams).toEqual({ type: 'fixture', handle: 'stripe' });
    expect(route.templateId).toBe('marketing');
    expect(route.mode).toBe('static');
    expect(route.stack).toBe('astro');
    expect(route.cms).toBe('sanity');
  });

  it('default values for all three optional axes produce the shortest possible URL', () => {
    const withDefaults = buildSearchString('fixture:stripe', 'landing', DEFAULT_MODE, DEFAULT_STACK, DEFAULT_CMS);
    const withoutOptionals = buildSearchString('fixture:stripe', 'landing');
    expect(withDefaults).toBe(withoutOptionals);
  });

  it('non-default stack and cms each add exactly one parameter to the query string', () => {
    const base = new URLSearchParams(buildSearchString('fixture:stripe', 'landing'));
    const extended = new URLSearchParams(buildSearchString('fixture:stripe', 'landing', undefined, 'next', 'sanity'));
    expect(extended.size - base.size).toBe(2);
    expect(extended.get('stack')).toBe('next');
    expect(extended.get('cms')).toBe('sanity');
  });

  it.each(ALL_STACKS.flatMap((stack) => ALL_CMS.map((cms) => [stack, cms] as const)))(
    'stack=%s cms=%s round-trips without loss for all 12 combinations',
    (stack, cms) => {
      const search = buildSearchString('fixture:github', 'dashboard', 'hybrid', stack, cms);
      const route = parseRoute(search);
      expect(route.stack).toBe(stack);
      expect(route.cms).toBe(cms);
    },
  );
});
