// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { describe, expect, it, vi, afterEach } from 'vitest';
import { fetchFromUrl } from '../src/lib/pull/from-url.js';
import { mockFetch } from './mock-fetch.js';

afterEach(() => { vi.restoreAllMocks(); });

const HTML_FULL_OG = `<!DOCTYPE html>
<html>
<head>
  <meta property="og:site_name" content="Acme Corp" />
  <meta property="og:title" content="Acme Corp | Build tools for the modern web" />
  <meta property="og:description" content="Acme builds the best developer tools for teams." />
  <meta name="theme-color" content="#6366f1" />
  <link rel="icon" href="/favicon.ico" />
</head>
<body></body>
</html>`;

const HTML_OG_TITLE_META_DESC = `<!DOCTYPE html>
<html>
<head>
  <meta property="og:title" content="Tools | Acme" />
  <meta name="description" content="Description from meta tag." />
  <link rel="icon" href="/favicon.ico" />
</head>
<body></body>
</html>`;

const HTML_OG_TITLE_AND_TITLE = `<!DOCTYPE html>
<html>
<head>
  <meta property="og:title" content="OG title wins" />
  <title>Page title loses</title>
</head>
<body></body>
</html>`;

const HTML_WHITESPACE_OG_TITLE = `<!DOCTYPE html>
<html>
<head>
  <meta property="og:title" content="   " />
  <title>Fallback title</title>
</head>
<body></body>
</html>`;

const HTML_OG_DESC_AND_META_DESC = `<!DOCTYPE html>
<html>
<head>
  <meta property="og:title" content="OG Title" />
  <meta property="og:description" content="OG description wins." />
  <meta name="description" content="Meta description loses." />
</head>
<body></body>
</html>`;

const HTML_WHITESPACE_OG_DESC = `<!DOCTYPE html>
<html>
<head>
  <meta property="og:title" content="OG Title" />
  <meta property="og:description" content="   " />
  <meta name="description" content="Meta description fallback." />
</head>
<body></body>
</html>`;

const HTML_TITLE_ONLY = `<!DOCTYPE html>
<html>
<head>
  <title>Acme Corp | Build tools</title>
  <meta name="theme-color" content="#0f172a" />
</head>
<body></body>
</html>`;

const HTML_JSON_LD_ORG = `<!DOCTYPE html>
<html>
<head>
  <script type="application/ld+json">
    {"@type":"Organization","name":"Org From JSON-LD","description":"We build things with JSON-LD."}
  </script>
</head>
<body></body>
</html>`;

const HTML_JSON_LD_LOCAL_BUSINESS = `<!DOCTYPE html>
<html>
<head>
  <script type="application/ld+json">
    {"@type":"LocalBusiness","name":"Local Co","description":"A local business."}
  </script>
</head>
<body></body>
</html>`;

const HTML_JSON_LD_CORPORATION = `<!DOCTYPE html>
<html>
<head>
  <script type="application/ld+json">
    {"@type":"Corporation","name":"Big Corp","description":"A large corporation."}
  </script>
</head>
<body></body>
</html>`;

const HTML_JSON_LD_GRAPH = `<!DOCTYPE html>
<html>
<head>
  <script type="application/ld+json">
    {"@context":"https://schema.org","@graph":[
      {"@type":"Organization","name":"Graph Org","description":"Description from @graph node."},
      {"@type":"WebSite","description":"Website description fallback."}
    ]}
  </script>
</head>
<body></body>
</html>`;

const HTML_MALFORMED_JSON_LD = `<!DOCTYPE html>
<html>
<head>
  <script type="application/ld+json">{ "broken": true, }</script>
  <title>Still works after bad JSON-LD</title>
</head>
<body></body>
</html>`;

const HTML_EM_DASH = `<!DOCTYPE html>
<html>
<head>
  <meta property="og:title" content="Brand—The Best" />
  <meta property="og:description" content="We are the best—no question." />
</head>
<body></body>
</html>`;

const HTML_FLAG_EMOJI = `<!DOCTYPE html>
<html>
<head>
  <meta property="og:title" content="🇬🇧 Global Brand" />
  <meta property="og:description" content="We operate in 🇺🇸 and beyond." />
</head>
<body></body>
</html>`;

const HTML_META_DESC_EM_DASH = `<!DOCTYPE html>
<html>
<head>
  <meta name="description" content="Great tools — fast results" />
</head>
<body></body>
</html>`;

const HTML_TITLE_EM_DASH = `<!DOCTYPE html>
<html>
<head>
  <title>Brand—The Platform</title>
</head>
<body></body>
</html>`;

const HTML_JSON_LD_EM_DASH_ORG = `<!DOCTYPE html>
<html>
<head>
  <script type="application/ld+json">
    {"@type":"Organization","name":"Brand—Pioneer","description":"We power the best—no doubt."}
  </script>
</head>
<body></body>
</html>`;

describe('voiceCanonical field — cascade rung selection', () => {
  it('reads og:title verbatim at high confidence', async () => {
    mockFetch(HTML_FULL_OG);
    const doc = await fetchFromUrl('https://acme.example.com');
    expect(doc.fields.voiceCanonical.value).toBe('Acme Corp | Build tools for the modern web');
    expect(doc.fields.voiceCanonical.confidence).toBe('high');
    expect(doc.fields.voiceCanonical.source).toBe('og:title');
  });

  it('voiceCanonical is verbatim from og:title while name strips the title trailer', async () => {
    mockFetch(HTML_FULL_OG);
    const doc = await fetchFromUrl('https://acme.example.com');
    expect(doc.fields.name.value).toBe('Acme Corp');
    expect(doc.fields.voiceCanonical.value).toBe('Acme Corp | Build tools for the modern web');
  });

  it('voiceCanonical preserves <title> verbatim while name strips the trailer', async () => {
    mockFetch(HTML_TITLE_ONLY);
    const doc = await fetchFromUrl('https://title.example.com');
    expect(doc.fields.name.value).toBe('Acme Corp');
    expect(doc.fields.voiceCanonical.value).toBe('Acme Corp | Build tools');
    expect(doc.fields.voiceCanonical.source).toBe('title');
  });

  it('og:title takes priority over <title> when both are present', async () => {
    mockFetch(HTML_OG_TITLE_AND_TITLE);
    const doc = await fetchFromUrl('https://priority.example.com');
    expect(doc.fields.voiceCanonical.value).toBe('OG title wins');
    expect(doc.fields.voiceCanonical.source).toBe('og:title');
  });

  it('whitespace-only og:title is treated as absent; falls through to <title>', async () => {
    mockFetch(HTML_WHITESPACE_OG_TITLE);
    const doc = await fetchFromUrl('https://ws.example.com');
    expect(doc.fields.voiceCanonical.value).toBe('Fallback title');
    expect(doc.fields.voiceCanonical.source).toBe('title');
  });

  it('falls through to <title> at medium confidence when og:title absent', async () => {
    mockFetch(HTML_TITLE_ONLY);
    const doc = await fetchFromUrl('https://title.example.com');
    expect(doc.fields.voiceCanonical.value).toBe('Acme Corp | Build tools');
    expect(doc.fields.voiceCanonical.confidence).toBe('medium');
    expect(doc.fields.voiceCanonical.source).toBe('title');
  });

  it('falls through to JSON-LD Organization.name at medium confidence', async () => {
    mockFetch(HTML_JSON_LD_ORG);
    const doc = await fetchFromUrl('https://org.example.com');
    expect(doc.fields.voiceCanonical.value).toBe('Org From JSON-LD');
    expect(doc.fields.voiceCanonical.confidence).toBe('medium');
    expect(doc.fields.voiceCanonical.source).toBe('json-ld:Organization.name');
  });

  it('LocalBusiness JSON-LD type is recognized same as Organization for voiceCanonical', async () => {
    mockFetch(HTML_JSON_LD_LOCAL_BUSINESS);
    const doc = await fetchFromUrl('https://local.example.com');
    expect(doc.fields.voiceCanonical.value).toBe('Local Co');
    expect(doc.fields.voiceCanonical.confidence).toBe('medium');
  });

  it('Corporation JSON-LD type name is recognized same as Organization for voiceCanonical', async () => {
    mockFetch(HTML_JSON_LD_CORPORATION);
    const doc = await fetchFromUrl('https://corp-canonical.example.com');
    expect(doc.fields.voiceCanonical.value).toBe('Big Corp');
    expect(doc.fields.voiceCanonical.confidence).toBe('medium');
    expect(doc.fields.voiceCanonical.source).toBe('json-ld:Organization.name');
  });

  it('reads JSON-LD Organization.name from @graph array at medium confidence', async () => {
    mockFetch(HTML_JSON_LD_GRAPH);
    const doc = await fetchFromUrl('https://graph.example.com');
    expect(doc.fields.voiceCanonical.value).toBe('Graph Org');
    expect(doc.fields.voiceCanonical.confidence).toBe('medium');
  });

  it('malformed JSON-LD is silently skipped; <title> is used as fallback', async () => {
    mockFetch(HTML_MALFORMED_JSON_LD);
    const doc = await fetchFromUrl('https://badjson.example.com');
    expect(doc.fields.voiceCanonical.value).toBe('Still works after bad JSON-LD');
    expect(doc.fields.voiceCanonical.confidence).toBe('medium');
  });

  it('returns none confidence and pushes voice-canonical-extract degradation when all rungs exhausted', async () => {
    mockFetch('<html><head></head><body></body></html>');
    const doc = await fetchFromUrl('https://empty.example.com');
    expect(doc.fields.voiceCanonical.confidence).toBe('none');
    expect(doc.fields.voiceCanonical.value).toBeNull();
    expect(doc.provenance.degradations.some(
      (d) => d.step === 'voice-canonical-extract' && d.reason === 'absent-in-source',
    )).toBe(true);
  });

  it('does not push voice-canonical-extract degradation when og:title is present', async () => {
    mockFetch(HTML_FULL_OG);
    const doc = await fetchFromUrl('https://acme.example.com');
    expect(doc.fields.voiceCanonical.confidence).toBe('high');
    expect(doc.provenance.degradations.some(
      (d) => d.step === 'voice-canonical-extract',
    )).toBe(false);
  });

  it.each([
    ['og-title',       HTML_EM_DASH,              'og:title'                 ],
    ['title',          HTML_TITLE_EM_DASH,        'title'                    ],
    ['jsonld-org-name', HTML_JSON_LD_EM_DASH_ORG, 'json-ld:Organization.name'],
  ])('em-dash in voiceCanonical from %s rung is replaced with en-dash', async (urlSlug, html, expectedSource) => {
    mockFetch(html);
    const doc = await fetchFromUrl(`https://emdash-canonical-${urlSlug}.example.com`);
    expect(doc.fields.voiceCanonical.source).toBe(expectedSource);
    expect(doc.fields.voiceCanonical.value).not.toContain('—');
    expect(doc.fields.voiceCanonical.value).toContain('–');
  });

  it('strips flag emoji pairs from og:title', async () => {
    mockFetch(HTML_FLAG_EMOJI);
    const doc = await fetchFromUrl('https://emoji.example.com');
    expect(doc.fields.voiceCanonical.value).not.toMatch(/[\u{1F1E0}-\u{1F1FF}]{2}/u);
  });
});

describe('voiceDescription field — cascade rung selection', () => {
  it('reads og:description at high confidence', async () => {
    mockFetch(HTML_FULL_OG);
    const doc = await fetchFromUrl('https://acme.example.com');
    expect(doc.fields.voiceDescription.value).toBe('Acme builds the best developer tools for teams.');
    expect(doc.fields.voiceDescription.confidence).toBe('high');
    expect(doc.fields.voiceDescription.source).toBe('og:description');
  });

  it('og:description takes priority over meta[name=description] when both are present', async () => {
    mockFetch(HTML_OG_DESC_AND_META_DESC);
    const doc = await fetchFromUrl('https://priority.example.com');
    expect(doc.fields.voiceDescription.value).toBe('OG description wins.');
    expect(doc.fields.voiceDescription.source).toBe('og:description');
  });

  it('whitespace-only og:description is treated as absent; falls through to meta[name=description]', async () => {
    mockFetch(HTML_WHITESPACE_OG_DESC);
    const doc = await fetchFromUrl('https://ws.example.com');
    expect(doc.fields.voiceDescription.value).toBe('Meta description fallback.');
    expect(doc.fields.voiceDescription.source).toBe('meta[name=description]');
  });

  it('falls through to meta[name=description] at high confidence when og:description absent', async () => {
    mockFetch(HTML_OG_TITLE_META_DESC);
    const doc = await fetchFromUrl('https://metadesc.example.com');
    expect(doc.fields.voiceDescription.value).toBe('Description from meta tag.');
    expect(doc.fields.voiceDescription.confidence).toBe('high');
    expect(doc.fields.voiceDescription.source).toBe('meta[name=description]');
  });

  it('falls through to JSON-LD Organization.description at medium confidence', async () => {
    mockFetch(HTML_JSON_LD_ORG);
    const doc = await fetchFromUrl('https://org.example.com');
    expect(doc.fields.voiceDescription.value).toBe('We build things with JSON-LD.');
    expect(doc.fields.voiceDescription.confidence).toBe('medium');
    expect(doc.fields.voiceDescription.source).toBe('json-ld:description');
  });

  it('Corporation JSON-LD type description is recognized same as Organization', async () => {
    mockFetch(HTML_JSON_LD_CORPORATION);
    const doc = await fetchFromUrl('https://corp.example.com');
    expect(doc.fields.voiceDescription.value).toBe('A large corporation.');
    expect(doc.fields.voiceDescription.confidence).toBe('medium');
  });

  it('falls through to JSON-LD WebSite.description when Organization.description absent', async () => {
    const htmlWebSite = `<html><head>
      <script type="application/ld+json">
        {"@context":"https://schema.org","@graph":[
          {"@type":"WebSite","description":"WebSite description for this domain."}
        ]}
      </script>
    </head><body></body></html>`;
    mockFetch(htmlWebSite);
    const doc = await fetchFromUrl('https://website.example.com');
    expect(doc.fields.voiceDescription.value).toBe('WebSite description for this domain.');
    expect(doc.fields.voiceDescription.confidence).toBe('medium');
  });

  it('Organization.description is preferred over WebSite.description in the same @graph', async () => {
    mockFetch(HTML_JSON_LD_GRAPH);
    const doc = await fetchFromUrl('https://graph.example.com');
    expect(doc.fields.voiceDescription.value).toBe('Description from @graph node.');
  });

  it('returns none confidence and pushes voice-description-extract degradation when all rungs exhausted', async () => {
    mockFetch('<html><head></head><body></body></html>');
    const doc = await fetchFromUrl('https://empty.example.com');
    expect(doc.fields.voiceDescription.confidence).toBe('none');
    expect(doc.fields.voiceDescription.value).toBeNull();
    expect(doc.provenance.degradations.some(
      (d) => d.step === 'voice-description-extract' && d.reason === 'absent-in-source',
    )).toBe(true);
  });

  it('does not push voice-description-extract degradation when og:description is present', async () => {
    mockFetch(HTML_FULL_OG);
    const doc = await fetchFromUrl('https://acme.example.com');
    expect(doc.fields.voiceDescription.confidence).toBe('high');
    expect(doc.provenance.degradations.some(
      (d) => d.step === 'voice-description-extract',
    )).toBe(false);
  });

  it.each([
    ['og-description',      HTML_EM_DASH,              'og:description'        ],
    ['meta-description',    HTML_META_DESC_EM_DASH,    'meta[name=description]'],
    ['json-ld-description', HTML_JSON_LD_EM_DASH_ORG,  'json-ld:description'   ],
  ])('em-dash in voiceDescription from %s rung is replaced with en-dash', async (urlSlug, html, expectedSource) => {
    mockFetch(html);
    const doc = await fetchFromUrl(`https://emdash-desc-${urlSlug}.example.com`);
    expect(doc.fields.voiceDescription.source).toBe(expectedSource);
    expect(doc.fields.voiceDescription.value).not.toContain('—');
    expect(doc.fields.voiceDescription.value).toContain('–');
  });

  it('strips flag emoji from og:description', async () => {
    mockFetch(HTML_FLAG_EMOJI);
    const doc = await fetchFromUrl('https://emoji.example.com');
    expect(doc.fields.voiceDescription.value).not.toMatch(/[\u{1F1E0}-\u{1F1FF}]{2}/u);
  });
});
