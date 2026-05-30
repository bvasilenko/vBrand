// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { describe, expect, it, vi, afterEach } from 'vitest';
import { fetchFromUrl } from '../src/lib/pull/from-url.js';
import { mockFetch } from './mock-fetch.js';

afterEach(() => { vi.restoreAllMocks(); });

const HTML_JSON_LD_BRAND_NESTED = `<!DOCTYPE html>
<html>
<head>
  <script type="application/ld+json">
    {"@type":"Organization","name":"Acme","brand":{"@type":"Brand","color":"#635BFF"}}
  </script>
</head>
<body></body>
</html>`;

const HTML_JSON_LD_BRAND_GRAPH = `<!DOCTYPE html>
<html>
<head>
  <script type="application/ld+json">
    {"@context":"https://schema.org","@graph":[
      {"@type":"Organization","name":"Graph Org"},
      {"@type":"Brand","color":"#0f172a"}
    ]}
  </script>
</head>
<body></body>
</html>`;

const HTML_JSON_LD_NAMED_COLOR = `<!DOCTYPE html>
<html>
<head>
  <script type="application/ld+json">
    {"@type":"Brand","color":"blue"}
  </script>
</head>
<body></body>
</html>`;

const HTML_THEME_COLOR_INVALID_HEX = `<!DOCTYPE html>
<html>
<head>
  <meta name="theme-color" content="#GGGGGG" />
  <script type="application/ld+json">
    {"@type":"Brand","color":"#0f172a"}
  </script>
</head>
<body></body>
</html>`;

const HTML_INLINE_CSS_VARS = `<!DOCTYPE html>
<html>
<head>
  <title>CSS Var Brand</title>
</head>
<body>
<style>
  :root {
    --brand-color: #6366f1;
    --bg-color: rgb(15, 23, 42);
  }
</style>
</body>
</html>`;

const HTML_INLINE_CSS_NON_COLOR_VAR = `<!DOCTYPE html>
<html>
<head></head>
<body>
<style>
  :root {
    --brand-text: #111111;
    --primary-color: #6366f1;
  }
</style>
</body>
</html>`;

const HTML_INLINE_MULTI_STYLE_BLOCKS = `<!DOCTYPE html>
<html>
<head>
  <style>:root { --primary-color: #aabbcc; }</style>
</head>
<body>
  <style>:root { --secondary-color: #ddeeff; }</style>
</body>
</html>`;

const HTML_ALL_SIGNALS_PRESENT = `<!DOCTYPE html>
<html>
<head>
  <meta name="theme-color" content="#ff0000" />
  <script type="application/ld+json">
    {"@type":"Brand","color":"#0000ff"}
  </script>
  <style>:root { --primary-color: #00ff00; }</style>
</head>
<body></body>
</html>`;

const HTML_NO_COLOR_SIGNALS = `<!DOCTYPE html>
<html>
<head>
  <title>No Colors Here</title>
</head>
<body><p>No brand colors anywhere.</p></body>
</html>`;

const HTML_JSON_LD_RGB_COLOR = `<!DOCTYPE html>
<html>
<head>
  <script type="application/ld+json">
    {"@type":"Brand","color":"rgb(99, 102, 241)"}
  </script>
</head>
<body></body>
</html>`;

const HTML_THEME_COLOR_RGB = `<!DOCTYPE html>
<html>
<head>
  <meta name="theme-color" content="rgb(99, 102, 241)" />
  <script type="application/ld+json">
    {"@type":"Brand","color":"#635BFF"}
  </script>
</head>
<body></body>
</html>`;

const HTML_JSON_LD_ORG_BRAND_RGB = `<!DOCTYPE html>
<html>
<head>
  <script type="application/ld+json">
    {"@type":"Organization","name":"Acme","brand":{"@type":"Brand","color":"rgb(99, 102, 241)"}}
  </script>
</head>
<body></body>
</html>`;

const HTML_JSON_LD_BRAND_PRIORITY = `<!DOCTYPE html>
<html>
<head>
  <script type="application/ld+json">
    {"@context":"https://schema.org","@graph":[
      {"@type":"Organization","name":"Acme","brand":{"@type":"Brand","color":"#111111"}},
      {"@type":"Brand","color":"#222222"}
    ]}
  </script>
</head>
<body></body>
</html>`;
function htmlThemeColor(hex: string): string {
  return `<html><head><meta name="theme-color" content="${hex}" /></head><body></body></html>`;
}
function htmlJsonLdBrandColor(hex: string): string {
  return `<html><head><script type="application/ld+json">{"@type":"Brand","color":"${hex}"}</script></head><body></body></html>`;
}
function htmlCssVarColor(hex: string): string {
  return `<html><head><style>:root { --primary-color: ${hex}; }</style></head><body></body></html>`;
}
function htmlCssVarColors(values: string[]): string {
  const decls = values.map((v, i) => `--color-${i}: ${v};`).join(' ');
  return `<html><head><style>:root { ${decls} }</style></head><body></body></html>`;
}

describe('colors field — cascade rung selection', () => {
  it('Organization.brand.color (nested) yields medium confidence when theme-color absent', async () => {
    mockFetch(HTML_JSON_LD_BRAND_NESTED);
    const doc = await fetchFromUrl('https://acme.example.com');
    expect(doc.fields.colors.confidence).toBe('medium');
    expect(doc.fields.colors.value?.['primary']).toBe('#635BFF');
    expect(doc.fields.colors.source).toBe('json-ld:Brand.color');
  });

  it('top-level Brand node in @graph array yields medium confidence', async () => {
    mockFetch(HTML_JSON_LD_BRAND_GRAPH);
    const doc = await fetchFromUrl('https://graph.example.com');
    expect(doc.fields.colors.confidence).toBe('medium');
    expect(doc.fields.colors.value?.['primary']).toBe('#0f172a');
  });

  it('named color string in Brand.color is rejected; cascade falls through to none', async () => {
    mockFetch(HTML_JSON_LD_NAMED_COLOR);
    const doc = await fetchFromUrl('https://namedcolor.example.com');
    expect(doc.fields.colors.confidence).toBe('none');
    expect(doc.fields.colors.reason).toBe('dynamic-render-required');
  });

  it('invalid hex chars in theme-color are rejected; JSON-LD rung is used instead', async () => {
    mockFetch(HTML_THEME_COLOR_INVALID_HEX);
    const doc = await fetchFromUrl('https://invalidhex.example.com');
    expect(doc.fields.colors.confidence).toBe('medium');
    expect(doc.fields.colors.value?.['primary']).toBe('#0f172a');
  });

  it('inline <style> CSS-var yields low confidence when no higher rungs match', async () => {
    mockFetch(HTML_INLINE_CSS_VARS);
    const doc = await fetchFromUrl('https://css.example.com');
    expect(doc.fields.colors.confidence).toBe('low');
    expect(doc.fields.colors.value?.['primary']).toBeDefined();
    expect(doc.fields.colors.source).toBe('inline-style-css-var');
  });

  it('CSS var name without "color" in it is not extracted', async () => {
    mockFetch(HTML_INLINE_CSS_NON_COLOR_VAR);
    const doc = await fetchFromUrl('https://noncolor.example.com');
    expect(Object.keys(doc.fields.colors.value ?? {}).length).toBe(1);
    expect(doc.fields.colors.value?.['primary']).toBe('#6366f1');
  });

  it('multiple <style> blocks are all scanned for CSS-var colors', async () => {
    mockFetch(HTML_INLINE_MULTI_STYLE_BLOCKS);
    const doc = await fetchFromUrl('https://multi.example.com');
    expect(Object.keys(doc.fields.colors.value ?? {}).length).toBe(2);
  });

  it('theme-color meta takes priority over JSON-LD and inline CSS vars (high confidence)', async () => {
    mockFetch(HTML_ALL_SIGNALS_PRESENT);
    const doc = await fetchFromUrl('https://priority.example.com');
    expect(doc.fields.colors.confidence).toBe('high');
    expect(doc.fields.colors.value?.['primary']).toBe('#ff0000');
    expect(doc.fields.colors.source).toBe('theme-color-meta');
  });

  it('returns confidence:none with reason and provenance degradation when all color cascade rungs exhausted', async () => {
    mockFetch(HTML_NO_COLOR_SIGNALS);
    const doc = await fetchFromUrl('https://nocolor.example.com');
    expect(doc.fields.colors.confidence).toBe('none');
    expect(doc.fields.colors.reason).toBe('dynamic-render-required');
    expect(doc.provenance.degradations.some((d) => d.reason === 'dynamic-render-required')).toBe(true);
  });

  it.each([
    [2, ['#6366f1', 'rgb(15, 23, 42)'],                           ['primary', 'color-1']                          ],
    [3, ['#111111', '#222222', '#333333'],                         ['primary', 'color-1', 'color-2']               ],
    [4, ['#111111', '#222222', '#333333', '#444444'],              ['primary', 'color-1', 'color-2', 'color-3']    ],
  ])('CSS-var color map with %i entries assigns keys primary/color-N', async (count, values, expectedKeys) => {
    mockFetch(htmlCssVarColors(values));
    const doc = await fetchFromUrl(`https://colormap-${count}.example.com`);
    const colors = doc.fields.colors.value;
    expect(Object.keys(colors!).sort()).toEqual([...expectedKeys].sort());
    expect(colors!['primary']).toBe(values[0]);
    expect(colors!['color-1']).toBe(values[1]);
  });

  it('accepts rgb() color value from JSON-LD Brand.color', async () => {
    mockFetch(HTML_JSON_LD_RGB_COLOR);
    const doc = await fetchFromUrl('https://rgb.example.com');
    expect(doc.fields.colors.confidence).toBe('medium');
    expect(doc.fields.colors.value?.['primary']).toBe('rgb(99, 102, 241)');
  });

  it('accepts rgba() color value from inline <style> CSS-var', async () => {
    const html = `<html><head><style>:root { --primary-color: rgba(0,0,0,0.5); }</style></head><body></body></html>`;
    mockFetch(html);
    const doc = await fetchFromUrl('https://rgba.example.com');
    expect(doc.fields.colors.confidence).toBe('low');
    expect(doc.fields.colors.value?.['primary']).toBe('rgba(0,0,0,0.5)');
  });

  it('inline CSS-var parse is scoped to inline <style> blocks — no network fetch for external stylesheet', async () => {
    const htmlWithExternalLink = `<html><head>
      <link rel="stylesheet" href="https://cdn.example.com/styles.css" />
      <style>:root { --primary-color: #111111; }</style>
    </head><body></body></html>`;
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      text: async () => htmlWithExternalLink,
      arrayBuffer: async () => new ArrayBuffer(0),
      headers: { get: () => null },
    });
    vi.stubGlobal('fetch', fetchSpy);
    const doc = await fetchFromUrl('https://external.example.com');
    const calls = fetchSpy.mock.calls.map((c: unknown[]) => c[0]);
    const cssNetworkFetch = calls.some((u: unknown) =>
      typeof u === 'string' && u.includes('cdn.example.com'),
    );
    expect(cssNetworkFetch).toBe(false);
    expect(doc.fields.colors.value?.['primary']).toBe('#111111');
  });

  it('rgb() value in theme-color is rejected; cascade falls through to JSON-LD rung', async () => {
    mockFetch(HTML_THEME_COLOR_RGB);
    const doc = await fetchFromUrl('https://rgbtheme.example.com');
    expect(doc.fields.colors.confidence).toBe('medium');
    expect(doc.fields.colors.value?.['primary']).toBe('#635BFF');
    expect(doc.fields.colors.source).toBe('json-ld:Brand.color');
  });

  it('Organization.brand.color with rgb() format is accepted at medium confidence', async () => {
    mockFetch(HTML_JSON_LD_ORG_BRAND_RGB);
    const doc = await fetchFromUrl('https://orgbrandrgb.example.com');
    expect(doc.fields.colors.confidence).toBe('medium');
    expect(doc.fields.colors.value?.['primary']).toBe('rgb(99, 102, 241)');
    expect(doc.fields.colors.source).toBe('json-ld:Brand.color');
  });

  it('Organization.brand.color takes priority over a separate Brand node in the same @graph', async () => {
    mockFetch(HTML_JSON_LD_BRAND_PRIORITY);
    const doc = await fetchFromUrl('https://brandpriority.example.com');
    expect(doc.fields.colors.confidence).toBe('medium');
    expect(doc.fields.colors.value?.['primary']).toBe('#111111');
    expect(doc.fields.colors.source).toBe('json-ld:Brand.color');
  });
});

describe('colors field — hex color length validation', () => {
  it.each([
    ['#f00',       'theme-color', htmlThemeColor,      'high'],
    ['#abcd',      'theme-color', htmlThemeColor,      'high'],
    ['#aabbcc',    'theme-color', htmlThemeColor,      'high'],
    ['#aabbccdd',  'theme-color', htmlThemeColor,      'high'],
    ['#abc',       'css-var',     htmlCssVarColor,     'low' ],
    ['#abcd',      'css-var',     htmlCssVarColor,     'low' ],
    ['#aabbcc',    'css-var',     htmlCssVarColor,     'low' ],
    ['#aabbccdd',  'css-var',     htmlCssVarColor,     'low' ],
  ])('%s hex from %s rung is accepted at %s confidence', async (hex, _rung, htmlFn, expectedConf) => {
    mockFetch(htmlFn(hex));
    const doc = await fetchFromUrl(`https://hex-valid-${hex.slice(1)}.example.com`);
    expect(doc.fields.colors.confidence).toBe(expectedConf);
    expect(doc.fields.colors.value?.['primary']).toBe(hex);
  });

  it.each([
    ['#ab',        'theme-color', htmlThemeColor      ],
    ['#12345',     'theme-color', htmlThemeColor      ],
    ['#1234567',   'theme-color', htmlThemeColor      ],
    ['#123456789', 'theme-color', htmlThemeColor      ],
    ['#12345',     'json-ld',     htmlJsonLdBrandColor],
    ['#1234567',   'json-ld',     htmlJsonLdBrandColor],
    ['#12345',     'css-var',     htmlCssVarColor     ],
    ['#1234567',   'css-var',     htmlCssVarColor     ],
  ])('%s hex from %s rung is rejected; cascade exhausts to none', async (hex, rung, htmlFn) => {
    mockFetch(htmlFn(hex));
    const doc = await fetchFromUrl(`https://hex-invalid-${rung}-${hex.slice(1)}.example.com`);
    expect(doc.fields.colors.confidence).toBe('none');
  });

  it('invalid hex length in theme-color rung is skipped; cascade falls through to JSON-LD rung', async () => {
    mockFetch(`<html><head>
      <meta name="theme-color" content="#12345" />
      <script type="application/ld+json">{"@type":"Brand","color":"#0f172a"}</script>
    </head><body></body></html>`);
    const doc = await fetchFromUrl('https://hex-length-fallthrough.example.com');
    expect(doc.fields.colors.confidence).toBe('medium');
    expect(doc.fields.colors.value?.['primary']).toBe('#0f172a');
    expect(doc.fields.colors.source).toBe('json-ld:Brand.color');
  });
});
