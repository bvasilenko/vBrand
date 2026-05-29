// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { describe, expect, it } from 'vitest';
import { stripEnvelopes } from '../src/lib/fuse/candidate-reader.js';
import { buildCandidateDoc, emptyFields } from '../src/lib/pull/candidate.js';
import { highField, mediumField, lowField, noneField } from '../src/lib/pull/confidence.js';
import type { CandidateDoc, CandidateFields } from '../src/lib/pull/candidate-schema.js';
import type { ConfidenceLevel } from '../src/lib/pull/confidence.js';

const FAVICON_VAL = { source: 'logo.png', sizes: [32, 180] };
const OG_VAL = { dimensions: [1200, 630] as [number, number] };
const ICONS_VAL = { source: 'icons/', set: ['check'] };

function makeDoc(overrides: Partial<CandidateFields> = {}, sourceUri = 'local:test'): CandidateDoc {
  return buildCandidateDoc('test-slug', sourceUri, { ...emptyFields(), ...overrides });
}

function fullHighDoc(): CandidateDoc {
  return makeDoc({
    name:             highField('Acme', 'test'),
    voiceCanonical:   highField('Terse voice.', 'test'),
    voiceDescription: highField('A test brand.', 'test'),
    colors:           highField({ primary: '#0f172a' }, 'test'),
    typeTokens:       highField({ base: '16px' }, 'test'),
    favicon:          highField(FAVICON_VAL, 'test'),
    og:               highField(OG_VAL, 'test'),
    icons:            highField(ICONS_VAL, 'test'),
  });
}

describe('stripEnvelopes - all high-confidence fields → canonical partial', () => {
  it('extracts name', () => {
    const partial = stripEnvelopes(fullHighDoc());
    expect(partial.name).toBe('Acme');
  });

  it('extracts voice.canonical and voice.repoDescription', () => {
    const partial = stripEnvelopes(fullHighDoc());
    expect(partial.voice?.canonical).toBe('Terse voice.');
    expect(partial.voice?.repoDescription).toBe('A test brand.');
  });

  it('extracts tokens.color', () => {
    const partial = stripEnvelopes(fullHighDoc());
    expect(partial.tokens?.color).toEqual({ primary: '#0f172a' });
  });

  it('extracts tokens.type', () => {
    const partial = stripEnvelopes(fullHighDoc());
    expect(partial.tokens?.type).toEqual({ base: '16px' });
  });

  it('extracts assets.favicon', () => {
    const partial = stripEnvelopes(fullHighDoc());
    expect(partial.assets?.favicon).toEqual(FAVICON_VAL);
  });

  it('extracts assets.og', () => {
    const partial = stripEnvelopes(fullHighDoc());
    expect(partial.assets?.og).toEqual(OG_VAL);
  });

  it('extracts assets.icons', () => {
    const partial = stripEnvelopes(fullHighDoc());
    expect(partial.assets?.icons).toEqual(ICONS_VAL);
  });

  it('includes sourceUri in sources[]', () => {
    const doc = makeDoc({ name: highField('X', 'test') }, 'https://example.com');
    const partial = stripEnvelopes(doc);
    expect(partial.sources).toContain('https://example.com');
  });
});

describe('stripEnvelopes - confidence threshold filtering', () => {
  const THRESHOLDS: ConfidenceLevel[] = ['high', 'medium', 'low', 'none'];

  it('default threshold is medium: rejects low-confidence fields', () => {
    const doc = makeDoc({
      name:   highField('Acme', 'test'),
      colors: lowField({ primary: '#abc' }, 'src', 'heuristic'),
    });
    const partial = stripEnvelopes(doc); // default: 'medium'
    expect(partial.name).toBe('Acme');
    expect(partial.tokens).toBeUndefined();
  });

  it('threshold medium accepts medium fields', () => {
    const doc = makeDoc({ name: mediumField('Acme', 'title') });
    const partial = stripEnvelopes(doc, 'medium');
    expect(partial.name).toBe('Acme');
  });

  it('threshold high rejects medium fields', () => {
    const doc = makeDoc({ name: mediumField('Acme', 'title') });
    const partial = stripEnvelopes(doc, 'high');
    expect(partial.name).toBeUndefined();
  });

  it('threshold low includes low-confidence fields', () => {
    const doc = makeDoc({
      name:   highField('Acme', 'test'),
      colors: lowField({ primary: '#abc' }, 'src', 'heuristic'),
    });
    const partial = stripEnvelopes(doc, 'low');
    expect(partial.tokens?.color).toEqual({ primary: '#abc' });
  });

  it('threshold none includes nothing (none confidence never passes any threshold)', () => {
    const doc = makeDoc({ name: noneField<string>('absent-in-source') });
    for (const threshold of THRESHOLDS) {
      const partial = stripEnvelopes(doc, threshold);
      expect(partial.name).toBeUndefined();
    }
  });
});

describe('stripEnvelopes - none fields are always excluded', () => {
  it('none-confidence name produces no name in partial', () => {
    const doc = makeDoc({ name: noneField<string>('absent-in-source') });
    expect(stripEnvelopes(doc, 'none').name).toBeUndefined();
  });

  it('none-confidence colors produces no tokens.color in partial', () => {
    const doc = makeDoc({ colors: noneField<Record<string,string>>('absent') });
    expect(stripEnvelopes(doc, 'none').tokens).toBeUndefined();
  });

  it('none-confidence favicon produces no assets.favicon', () => {
    const doc = makeDoc({ favicon: noneField<typeof FAVICON_VAL>('absent') });
    expect(stripEnvelopes(doc, 'none').assets?.favicon).toBeUndefined();
  });
});

describe('stripEnvelopes - partial documents (only some fields present)', () => {
  it('only extracts the fields that meet the threshold', () => {
    const doc = makeDoc({
      name:   highField('Acme', 'test'),
      colors: noneField('absent'),
      favicon: noneField('absent'),
    });
    const partial = stripEnvelopes(doc);
    expect(partial.name).toBe('Acme');
    expect(partial.tokens).toBeUndefined();
    expect(partial.assets?.favicon).toBeUndefined();
  });

  it('produces empty object when all fields are none', () => {
    const doc = makeDoc(); // all emptyFields() = none
    const partial = stripEnvelopes(doc);
    expect(partial.name).toBeUndefined();
    expect(partial.tokens).toBeUndefined();
    expect(partial.assets).toBeUndefined();
    expect(partial.voice).toBeUndefined();
  });

  it('omits voice object entirely when both voice fields are none', () => {
    const doc = makeDoc({
      voiceCanonical:   noneField('absent'),
      voiceDescription: noneField('absent'),
    });
    expect(stripEnvelopes(doc).voice).toBeUndefined();
  });

  it('includes partial voice when one sub-field is present', () => {
    const doc = makeDoc({
      voiceCanonical:   highField('Terse.', 'test'),
      voiceDescription: noneField('absent'),
    });
    const partial = stripEnvelopes(doc);
    expect(partial.voice?.canonical).toBe('Terse.');
    expect(partial.voice?.repoDescription).toBeUndefined();
  });

  it('omits tokens when both color and type are none', () => {
    const doc = makeDoc({
      colors:     noneField('absent'),
      typeTokens: noneField('absent'),
    });
    expect(stripEnvelopes(doc).tokens).toBeUndefined();
  });

  it('includes tokens with only color when type is none', () => {
    const doc = makeDoc({
      colors:     highField({ primary: '#fff' }, 'test'),
      typeTokens: noneField('absent'),
    });
    const partial = stripEnvelopes(doc);
    expect(partial.tokens?.color).toEqual({ primary: '#fff' });
    expect(partial.tokens?.type).toBeUndefined();
  });
});

describe('stripEnvelopes - optional canonical fields (marks, themes, etc.)', () => {
  it('extracts marks when high-confidence', () => {
    const marks = { logoMinWidth: 32 };
    const doc = makeDoc({ marks: highField(marks, 'test') });
    expect(stripEnvelopes(doc).marks).toEqual(marks);
  });

  it('excludes marks when none-confidence', () => {
    const doc = makeDoc({ marks: noneField('absent') });
    expect(stripEnvelopes(doc).marks).toBeUndefined();
  });

  it('extracts slots when high-confidence', () => {
    const slots = { tagline: { value: 'Build fast.' } };
    const doc = makeDoc({ slots: highField(slots, 'test') });
    expect(stripEnvelopes(doc).slots).toEqual(slots);
  });

  it('extracts fusePolicies when high-confidence', () => {
    const policies = { 'tokens.color': 'array-union' };
    const doc = makeDoc({ fusePolicies: highField(policies, 'test') });
    expect(stripEnvelopes(doc).fusePolicies).toEqual(policies);
  });
});

describe('stripEnvelopes - assets partial object', () => {
  it('omits assets object entirely when all three asset fields are none', () => {
    const doc = makeDoc({
      favicon: noneField('absent'),
      og:      noneField('absent'),
      icons:   noneField('absent'),
    });
    expect(stripEnvelopes(doc).assets).toBeUndefined();
  });

  it('includes assets object with only og when favicon and icons are none', () => {
    const doc = makeDoc({
      favicon: noneField('absent'),
      og:      highField(OG_VAL, 'test'),
      icons:   noneField('absent'),
    });
    const partial = stripEnvelopes(doc);
    expect(partial.assets?.og).toEqual(OG_VAL);
    expect(partial.assets?.favicon).toBeUndefined();
    expect(partial.assets?.icons).toBeUndefined();
  });
});

describe('stripEnvelopes - sources array', () => {
  it('always includes sources[] with the sourceUri', () => {
    const doc = makeDoc({}, 'npm:my-package');
    expect(stripEnvelopes(doc).sources).toContain('npm:my-package');
  });

  it('sources is an array even when doc is empty', () => {
    const doc = makeDoc();
    expect(Array.isArray(stripEnvelopes(doc).sources)).toBe(true);
  });
});
