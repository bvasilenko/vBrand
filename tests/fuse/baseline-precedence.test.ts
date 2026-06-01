// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterAll, describe, expect, it } from 'vitest';
import { runFuse } from '../../src/commands/fuse.js';
import { buildCandidateDoc, emptyFields } from '../../src/lib/pull/candidate.js';
import { highField, lowField, mediumField, noneField } from '../../src/lib/pull/confidence.js';
import { buildBaselinePartial } from '../../src/lib/baseline/partial-builder.js';
import {
  BASELINE_CACHE_REL_DIR,
  BASELINE_NAME,
  BASELINE_VOICE_CANONICAL,
  BASELINE_COLOR_PRIMARY,
  PLACEHOLDER_FAVICON_FILENAME,
  PLACEHOLDER_ICON_FILENAME,
  PLACEHOLDER_SVG,
  ICONS_SUB_DIR,
} from '../../src/lib/baseline/schema-values.js';
import { writeBaselineAssets } from '../../src/lib/baseline/asset-writer.js';
import { insertAtLowestPrecedence } from '../../src/lib/baseline/precedence.js';
import { runScrubGate } from '../../src/lib/scrub-gate.js';
import { VbrandSchema } from '../../src/schema.js';
import type { CandidateDoc } from '../../src/lib/pull/candidate-schema.js';
import type { FuseStrategy } from '../../src/lib/fuse/strategies.js';


const dirs: string[] = [];
afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });

const tmp = (): string => {
  const d = mkdtempSync(join(tmpdir(), 'vbrand-bl-'));
  dirs.push(d);
  return d;
};

function writeCandidateFile(dir: string, name: string, doc: CandidateDoc): string {
  const p = join(dir, `${name}.candidate.json`);
  writeFileSync(p, JSON.stringify(doc, null, 2), 'utf-8');
  return p;
}


const REAL_FAVICON  = { source: 'real-logo.png', sizes: [16, 32, 180] };
const REAL_ICONS    = { source: 'real-icons/', set: ['arrow', 'check'] };
const REAL_OG       = { dimensions: [1200, 630] as [number, number] };
const REAL_COLORS   = { primary: '#ff0000', accent: '#00ff00' };
const REAL_TYPE     = { body: 'Inter, sans-serif', heading: 'Sora, sans-serif' };

const DOC_FULL = buildCandidateDoc('full', 'local:full', {
  ...emptyFields(),
  name:             highField('RealBrand', 'og:title'),
  voiceCanonical:   highField('RealBrand voice', 'og:title'),
  voiceDescription: highField('RealBrand description', 'og:description'),
  colors:           highField(REAL_COLORS, 'css-var'),
  typeTokens:       highField(REAL_TYPE, 'css-var'),
  favicon:          highField(REAL_FAVICON, 'link[rel=icon]'),
  og:               highField(REAL_OG, 'og:image'),
  icons:            highField(REAL_ICONS, 'local-scan'),
});

const DOC_PARTIAL = buildCandidateDoc('partial', 'local:partial', {
  ...emptyFields(),
  name:             highField('PartialBrand', 'og:title'),
  voiceCanonical:   highField('PartialBrand voice', 'og:title'),
  voiceDescription: highField('PartialBrand desc', 'og:description'),
  favicon:          highField({ source: 'real-logo.png', sizes: [32] }, 'link[rel=icon]'),
  og:               highField(REAL_OG, 'default'),
  colors:           noneField('dynamic-render-required', '--color <hex>'),
  typeTokens:       noneField('absent-in-source'),
  icons:            noneField('absent-in-source'),
});

const DOC_EMPTY = buildCandidateDoc('empty', 'local:empty', emptyFields());

const DOC_SECOND = buildCandidateDoc('second', 'local:second', {
  ...emptyFields(),
  name:             highField('SecondBrand', 'og:title'),
  voiceCanonical:   highField('SecondBrand voice', 'og:title'),
  voiceDescription: highField('SecondBrand desc', 'og:description'),
  colors:           highField({ primary: '#0000ff' }, 'css-var'),
  typeTokens:       highField({ body: 'Georgia, serif' }, 'css-var'),
  favicon:          highField({ source: 'second-logo.png', sizes: [32] }, 'link[rel=icon]'),
  og:               highField(REAL_OG, 'og:image'),
  icons:            noneField('absent-in-source'),
});


describe('insertAtLowestPrecedence - umbrella-wins positional invariants', () => {
  it('baseline lands at the last position with one candidate', () => {
    const real = { name: 'real' };
    const bl   = { name: 'baseline' };
    const out  = insertAtLowestPrecedence([real], bl, 'umbrella-wins');
    expect(out[out.length - 1]).toBe(bl);
  });

  it('baseline lands at the last position with multiple candidates', () => {
    const a = { v: 1 }, b = { v: 2 }, bl = { v: 0 };
    const out = insertAtLowestPrecedence([a, b], bl, 'umbrella-wins');
    expect(out[out.length - 1]).toBe(bl);
    expect(out[0]).toBe(a);
  });

  it('candidate relative order is preserved', () => {
    const a = { n: 1 }, b = { n: 2 }, c = { n: 3 }, bl = { n: 0 };
    const out = insertAtLowestPrecedence([a, b, c], bl, 'umbrella-wins');
    expect(out[0]).toBe(a);
    expect(out[1]).toBe(b);
    expect(out[2]).toBe(c);
  });

  it('output length is N + 1', () => {
    const candidates = [{ v: 1 }, { v: 2 }, { v: 3 }];
    const out = insertAtLowestPrecedence(candidates, { v: 0 }, 'umbrella-wins');
    expect(out).toHaveLength(candidates.length + 1);
  });

  it('empty candidate list produces [baseline]', () => {
    const bl  = { name: 'baseline' };
    const out = insertAtLowestPrecedence([], bl, 'umbrella-wins');
    expect(out).toEqual([bl]);
  });

  it('does not mutate the input array', () => {
    const candidates = [{ name: 'x' }];
    insertAtLowestPrecedence(candidates, { name: 'bl' }, 'umbrella-wins');
    expect(candidates).toHaveLength(1);
  });
});

describe('insertAtLowestPrecedence - last-wins strategies positional invariants', () => {
  const LAST_WINS_STRATEGIES: FuseStrategy[] = ['cascade', 'merge-patch'];

  for (const strategy of LAST_WINS_STRATEGIES) {
    it(`${strategy}: baseline lands at the first position with one candidate`, () => {
      const real = { name: 'real' };
      const bl   = { name: 'baseline' };
      const out  = insertAtLowestPrecedence([real], bl, strategy);
      expect(out[0]).toBe(bl);
      expect(out[out.length - 1]).toBe(real);
    });

    it(`${strategy}: baseline lands at the first position with multiple candidates`, () => {
      const a = { v: 1 }, b = { v: 2 }, bl = { v: 0 };
      const out = insertAtLowestPrecedence([a, b], bl, strategy);
      expect(out[0]).toBe(bl);
      expect(out[1]).toBe(a);
      expect(out[2]).toBe(b);
    });

    it(`${strategy}: candidate relative order is preserved`, () => {
      const a = { n: 1 }, b = { n: 2 }, c = { n: 3 }, bl = { n: 0 };
      const out = insertAtLowestPrecedence([a, b, c], bl, strategy);
      expect(out[1]).toBe(a);
      expect(out[2]).toBe(b);
      expect(out[3]).toBe(c);
    });

    it(`${strategy}: output length is N + 1`, () => {
      const candidates = [{ v: 1 }, { v: 2 }];
      const out = insertAtLowestPrecedence(candidates, { v: 0 }, strategy);
      expect(out).toHaveLength(candidates.length + 1);
    });

    it(`${strategy}: empty candidate list produces [baseline]`, () => {
      const bl  = { name: 'baseline' };
      const out = insertAtLowestPrecedence([], bl, strategy);
      expect(out).toEqual([bl]);
    });

    it(`${strategy}: does not mutate the input array`, () => {
      const candidates = [{ name: 'x' }];
      insertAtLowestPrecedence(candidates, { name: 'bl' }, strategy);
      expect(candidates).toHaveLength(1);
    });
  }
});


describe('buildBaselinePartial - schema completeness and structural invariants', () => {
  it('is parseable as a complete VbrandType', () => {
    expect(VbrandSchema.safeParse(buildBaselinePartial()).success).toBe(true);
  });

  it('is idempotent - two calls return deeply equal objects', () => {
    expect(buildBaselinePartial()).toEqual(buildBaselinePartial());
  });

  it('favicon and icons sources are rooted under BASELINE_CACHE_REL_DIR', () => {
    const p = buildBaselinePartial();
    expect(p.assets.favicon.source).toContain(BASELINE_CACHE_REL_DIR);
    expect(p.assets.icons.source).toContain(BASELINE_CACHE_REL_DIR);
  });

  it('favicon sizes array is non-empty and contains only positive integers', () => {
    const sizes = buildBaselinePartial().assets.favicon.sizes;
    expect(sizes.length).toBeGreaterThan(0);
    expect(sizes.every((s) => Number.isInteger(s) && s > 0)).toBe(true);
  });

  it('og dimensions is a two-element tuple of positive integers', () => {
    const dims = buildBaselinePartial().assets.og.dimensions;
    expect(dims).toHaveLength(2);
    expect(dims.every((d) => Number.isInteger(d) && d > 0)).toBe(true);
  });

  it('all color tokens are valid 6-digit hex strings', () => {
    const colors = buildBaselinePartial().tokens.color;
    for (const [key, value] of Object.entries(colors)) {
      expect(value, `token.color.${key}`).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('all type tokens are non-empty strings', () => {
    const types = buildBaselinePartial().tokens.type;
    for (const [key, value] of Object.entries(types)) {
      expect(value, `token.type.${key}`).toMatch(/.+/);
    }
  });

  it('name, voice.canonical, and voice.repoDescription are non-empty strings', () => {
    const p = buildBaselinePartial();
    expect(p.name.length).toBeGreaterThan(0);
    expect(p.voice.canonical.length).toBeGreaterThan(0);
    expect(p.voice.repoDescription.length).toBeGreaterThan(0);
  });
});


describe('writeBaselineAssets - filesystem contract', () => {
  it('creates the icons subdirectory', async () => {
    const dir = tmp();
    await writeBaselineAssets(dir);
    expect(existsSync(join(dir, ICONS_SUB_DIR))).toBe(true);
  });

  it('writes the placeholder favicon PNG', async () => {
    const dir = tmp();
    await writeBaselineAssets(dir);
    expect(existsSync(join(dir, PLACEHOLDER_FAVICON_FILENAME))).toBe(true);
  });

  it('writes the placeholder icon SVG', async () => {
    const dir = tmp();
    await writeBaselineAssets(dir);
    expect(existsSync(join(dir, ICONS_SUB_DIR, PLACEHOLDER_ICON_FILENAME))).toBe(true);
  });

  it('favicon PNG is a valid raster image with positive dimensions', async () => {
    const dir = tmp();
    await writeBaselineAssets(dir);
    const meta = await sharp(join(dir, PLACEHOLDER_FAVICON_FILENAME)).metadata();
    expect(meta.format).toBe('png');
    expect(meta.width).toBeGreaterThan(0);
    expect(meta.height).toBeGreaterThan(0);
  });

  it('SVG file content contains a valid svg element', async () => {
    const dir = tmp();
    await writeBaselineAssets(dir);
    const content = readFileSync(join(dir, ICONS_SUB_DIR, PLACEHOLDER_ICON_FILENAME), 'utf-8');
    expect(content).toContain('<svg');
    expect(content).toContain('</svg>');
  });

  it('SVG content matches the canonical PLACEHOLDER_SVG constant', async () => {
    const dir = tmp();
    await writeBaselineAssets(dir);
    const content = readFileSync(join(dir, ICONS_SUB_DIR, PLACEHOLDER_ICON_FILENAME), 'utf-8');
    expect(content).toBe(PLACEHOLDER_SVG);
  });

  it('is idempotent - second call is a no-op and leaves files intact', async () => {
    const dir = tmp();
    await writeBaselineAssets(dir);
    const faviconBefore = readFileSync(join(dir, PLACEHOLDER_FAVICON_FILENAME));
    const svgBefore     = readFileSync(join(dir, ICONS_SUB_DIR, PLACEHOLDER_ICON_FILENAME));

    await expect(writeBaselineAssets(dir)).resolves.toBeUndefined();

    expect(readFileSync(join(dir, PLACEHOLDER_FAVICON_FILENAME))).toEqual(faviconBefore);
    expect(readFileSync(join(dir, ICONS_SUB_DIR, PLACEHOLDER_ICON_FILENAME))).toEqual(svgBefore);
  });
});


describe('runFuse --inject-baseline - input guard', () => {
  it('accepts exactly one input path when --inject-baseline is active', async () => {
    const dir  = tmp();
    const path = writeCandidateFile(dir, 'full', DOC_FULL);
    await expect(runFuse([path], { cwd: dir, injectBaseline: true })).resolves.toBeDefined();
  });

  it('rejects zero inputs even when --inject-baseline is active', async () => {
    const dir = tmp();
    await expect(runFuse([], { cwd: dir, injectBaseline: true })).rejects.toThrow('at least one');
  });

  it('rejects exactly one input when --inject-baseline is NOT active', async () => {
    const dir  = tmp();
    const path = writeCandidateFile(dir, 'full', DOC_FULL);
    await expect(runFuse([path], { cwd: dir })).rejects.toThrow('at least two');
  });
});


describe('runFuse --inject-baseline: umbrella-wins - real candidate wins every conflicting field', () => {
  it('all high-confidence real fields take precedence over baseline values', async () => {
    const dir  = tmp();
    const path = writeCandidateFile(dir, 'full', DOC_FULL);
    const r    = await runFuse([path], { cwd: dir, injectBaseline: true, strategy: 'umbrella-wins' });

    expect(r.schema.name).toBe('RealBrand');
    expect(r.schema.voice.canonical).toBe('RealBrand voice');
    expect(r.schema.voice.repoDescription).toBe('RealBrand description');
    expect(r.schema.tokens.color['primary']).toBe(REAL_COLORS.primary);
    expect(r.schema.tokens.type['body']).toBe(REAL_TYPE.body);
    expect(r.schema.assets.favicon.source).toBe(REAL_FAVICON.source);
    expect(r.schema.assets.icons.source).toBe(REAL_ICONS.source);
    expect(r.schema.assets.icons.set).toContain('arrow');
  });
});

describe('runFuse --inject-baseline: umbrella-wins - baseline fills fields below confidence threshold', () => {
  it('none-confidence fields in real candidate are filled by baseline values', async () => {
    const dir  = tmp();
    const path = writeCandidateFile(dir, 'partial', DOC_PARTIAL);
    const r    = await runFuse([path], { cwd: dir, injectBaseline: true, strategy: 'umbrella-wins' });

    expect(r.schema.tokens.color['primary']).toBeDefined();
    expect(r.schema.tokens.type['body']).toBeDefined();
    expect(r.schema.assets.icons.source).toContain(BASELINE_CACHE_REL_DIR);
    expect(VbrandSchema.safeParse(r.schema).success).toBe(true);
  });

  it('real-candidate fields that are present survive even when other fields come from baseline', async () => {
    const dir  = tmp();
    const path = writeCandidateFile(dir, 'partial', DOC_PARTIAL);
    const r    = await runFuse([path], { cwd: dir, injectBaseline: true });

    expect(r.schema.name).toBe('PartialBrand');
    expect(r.schema.voice.canonical).toBe('PartialBrand voice');
  });
});


describe('runFuse --inject-baseline: last-wins strategies - real candidate wins every conflicting field', () => {
  const LAST_WINS_STRATEGIES: FuseStrategy[] = ['cascade', 'merge-patch'];

  for (const strategy of LAST_WINS_STRATEGIES) {
    it(`${strategy}: all high-confidence real fields take precedence over baseline`, async () => {
      const dir  = tmp();
      const path = writeCandidateFile(dir, 'full', DOC_FULL);
      const r    = await runFuse([path], { cwd: dir, injectBaseline: true, strategy });

      expect(r.schema.name).toBe('RealBrand');
      expect(r.schema.tokens.color['primary']).toBe(REAL_COLORS.primary);
      expect(r.schema.tokens.type['body']).toBe(REAL_TYPE.body);
      expect(r.schema.assets.favicon.source).toBe(REAL_FAVICON.source);
      expect(r.schema.assets.icons.source).toBe(REAL_ICONS.source);
      expect(VbrandSchema.safeParse(r.schema).success).toBe(true);
    });
  }
});


describe('runFuse --inject-baseline: three-way precedence with multiple real candidates', () => {
  it('umbrella-wins: first candidate beats second candidate, both beat baseline', async () => {
    const dir   = tmp();
    const pathA = writeCandidateFile(dir, 'a', DOC_FULL);
    const pathB = writeCandidateFile(dir, 'b', DOC_SECOND);
    const r     = await runFuse([pathA, pathB], { cwd: dir, injectBaseline: true, strategy: 'umbrella-wins' });

    expect(r.schema.name).toBe('RealBrand');
    expect(r.schema.tokens.color['primary']).toBe(REAL_COLORS.primary);
    expect(r.schema.assets.icons.source).toBe(REAL_ICONS.source);
  });

  it('umbrella-wins: baseline fills fields absent from all real candidates', async () => {
    const dir   = tmp();
    const pathA = writeCandidateFile(dir, 'a', DOC_PARTIAL);
    const pathB = writeCandidateFile(dir, 'b', DOC_SECOND);
    const r     = await runFuse([pathA, pathB], { cwd: dir, injectBaseline: true, strategy: 'umbrella-wins' });

    expect(r.schema.assets.icons.source).toContain(BASELINE_CACHE_REL_DIR);
    expect(VbrandSchema.safeParse(r.schema).success).toBe(true);
  });
});


describe('runFuse --inject-baseline: acceptConfidence threshold interaction', () => {
  it('low-confidence real field wins over baseline when acceptConfidence is "low"', async () => {
    const doc = buildCandidateDoc('low-conf', 'local:low', {
      ...emptyFields(),
      name:             highField('LowConfBrand', 'og:title'),
      voiceCanonical:   highField('LowConfBrand voice', 'og:title'),
      voiceDescription: highField('LowConfBrand desc', 'og:description'),
      favicon:          highField({ source: 'logo.png', sizes: [32] }, 'link[rel=icon]'),
      og:               highField(REAL_OG, 'default'),
      colors:           lowField({ primary: '#aabbcc' }, 'css-heuristic', 'weak-signal'),
      typeTokens:       noneField('absent-in-source'),
      icons:            noneField('absent-in-source'),
    });
    const dir  = tmp();
    const path = writeCandidateFile(dir, 'low', doc);
    const r    = await runFuse([path], { cwd: dir, injectBaseline: true, acceptConfidence: 'low' });

    expect(r.schema.tokens.color['primary']).toBe('#aabbcc');
    expect(VbrandSchema.safeParse(r.schema).success).toBe(true);
  });

  it('medium-confidence real field is discarded when acceptConfidence is "high" and baseline fills it', async () => {
    const doc = buildCandidateDoc('medium-conf', 'local:medium', {
      ...emptyFields(),
      name:             highField('MedBrand', 'og:title'),
      voiceCanonical:   highField('MedBrand voice', 'og:title'),
      voiceDescription: highField('MedBrand desc', 'og:description'),
      favicon:          highField({ source: 'logo.png', sizes: [32] }, 'link[rel=icon]'),
      og:               highField(REAL_OG, 'default'),
      colors:           mediumField({ primary: '#112233' }, 'theme-color'),
      typeTokens:       noneField('absent-in-source'),
      icons:            noneField('absent-in-source'),
    });
    const dir  = tmp();
    const path = writeCandidateFile(dir, 'med', doc);
    const r    = await runFuse([path], { cwd: dir, injectBaseline: true, acceptConfidence: 'high' });

    expect(r.schema.tokens.color['primary']).toBe(BASELINE_COLOR_PRIMARY);
    expect(VbrandSchema.safeParse(r.schema).success).toBe(true);
  });
});


describe('runFuse --inject-baseline: output is always a valid canonical VbrandType', () => {
  const CASES: Array<{ label: string; doc: CandidateDoc }> = [
    { label: 'fully-provided candidate',   doc: DOC_FULL    },
    { label: 'partially-provided candidate', doc: DOC_PARTIAL },
    { label: 'empty candidate (all fields absent)', doc: DOC_EMPTY },
  ];

  for (const { label, doc } of CASES) {
    it(`produces a valid VbrandType from a ${label}`, async () => {
      const dir  = tmp();
      const path = writeCandidateFile(dir, 'doc', doc);
      const r    = await runFuse([path], { cwd: dir, injectBaseline: true });
      expect(VbrandSchema.safeParse(r.schema).success).toBe(true);
    });
  }
});


describe('baseline fixture: scrub-gate invariants', () => {
  const SCRUB_PATTERN_SETS: Array<{ label: string; patterns: string[] }> = [
    {
      label: 'common donor-brand names',
      patterns: ['stripe', 'github', 'google', 'apple', 'microsoft', 'acme', 'vercel', 'netlify'],
    },
    {
      label: 'PII and contact markers',
      patterns: ['@', '.com', 'user@', 'admin@', 'root@'],
    },
    {
      label: 'URL scheme markers',
      patterns: ['http://', 'https://', 'ftp://'],
    },
  ];

  for (const { label, patterns } of SCRUB_PATTERN_SETS) {
    it(`baseline partial contains no ${label}`, () => {
      const findings = runScrubGate(buildBaselinePartial(), patterns);
      expect(findings).toHaveLength(0);
    });
  }
});


describe('baseline fixture: values are brand-neutral sentinels distinguishable from real signals', () => {
  it('baseline name equals the BASELINE_NAME constant', () => {
    expect(buildBaselinePartial().name).toBe(BASELINE_NAME);
  });

  it('baseline voice.canonical equals the BASELINE_VOICE_CANONICAL constant', () => {
    expect(buildBaselinePartial().voice.canonical).toBe(BASELINE_VOICE_CANONICAL);
  });

  it('baseline primary color equals the BASELINE_COLOR_PRIMARY constant', () => {
    expect(buildBaselinePartial().tokens.color['primary']).toBe(BASELINE_COLOR_PRIMARY);
  });
});
