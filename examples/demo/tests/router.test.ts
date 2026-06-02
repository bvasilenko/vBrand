// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { describe, it, expect } from 'vitest';
import {
  parseRoute,
  buildSearchString,
  brandParamToString,
  type BrandParams,
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
