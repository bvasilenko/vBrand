// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  createOverridesDoc,
  setOverride,
  forgetOverride,
  readOverrides,
  writeOverrides,
  applyOverrides,
  activeOverrideCount,
  OVERRIDES_FILENAME,
} from '../../src/lib/sync/overrides.js';
import type { VbrandType } from '../../src/schema.js';

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

function tmpDir(): string {
  const d = mkdtempSync(join(tmpdir(), 'vbrand-overrides-'));
  dirs.push(d);
  return d;
}

const UMBRELLA_URL = 'file:///tmp/dist';
const BASE_DIGEST = 'abc123';

const BASE_SCHEMA: VbrandType = {
  name: 'umbrella',
  voice: { canonical: 'Umbrella.', repoDescription: 'Umbrella brand.' },
  assets: {
    favicon: { source: 'logo.png', sizes: [32] },
    og: { dimensions: [1200, 630] },
    icons: { source: 'icons/', set: [] },
  },
  tokens: { color: { primary: '#0f172a' }, type: {} },
};

describe('createOverridesDoc', () => {
  it('sets the $overrides marker to true', () => {
    const doc = createOverridesDoc(UMBRELLA_URL, BASE_DIGEST);
    expect(doc.$overrides).toBe(true);
  });

  it('embeds the umbrella URL and baseDigest', () => {
    const doc = createOverridesDoc(UMBRELLA_URL, BASE_DIGEST);
    expect(doc.umbrella).toBe(UMBRELLA_URL);
    expect(doc.baseDigest).toBe(BASE_DIGEST);
  });

  it('starts with an empty overrides record', () => {
    const doc = createOverridesDoc(UMBRELLA_URL, BASE_DIGEST);
    expect(Object.keys(doc.overrides)).toHaveLength(0);
  });
});

describe('setOverride', () => {
  it('adds a new entry with the given value', () => {
    const doc = setOverride(createOverridesDoc(UMBRELLA_URL, BASE_DIGEST), 'tokens.color.primary', '#fff');
    expect(doc.overrides['tokens.color.primary']!.value).toBe('#fff');
  });

  it('setAt is a parseable ISO 8601 timestamp', () => {
    const doc = setOverride(createOverridesDoc(UMBRELLA_URL, BASE_DIGEST), 'name', 'x');
    const ts = Date.parse(doc.overrides['name']!.setAt);
    expect(Number.isNaN(ts)).toBe(false);
  });

  it('stores the reason when provided', () => {
    const doc = setOverride(createOverridesDoc(UMBRELLA_URL, BASE_DIGEST), 'name', 'x', 'legacy screenshot');
    expect(doc.overrides['name']!.reason).toBe('legacy screenshot');
  });

  it('reason field is absent when not provided', () => {
    const doc = setOverride(createOverridesDoc(UMBRELLA_URL, BASE_DIGEST), 'name', 'x');
    expect('reason' in doc.overrides['name']!).toBe(false);
  });

  it('replaces an existing entry for the same path', () => {
    let doc = createOverridesDoc(UMBRELLA_URL, BASE_DIGEST);
    doc = setOverride(doc, 'name', 'first');
    doc = setOverride(doc, 'name', 'second');
    expect(doc.overrides['name']!.value).toBe('second');
    expect(Object.keys(doc.overrides)).toHaveLength(1);
  });

  it('a new entry does not affect other existing entries', () => {
    let doc = createOverridesDoc(UMBRELLA_URL, BASE_DIGEST);
    doc = setOverride(doc, 'name', 'preserved');
    doc = setOverride(doc, 'tokens.color.primary', '#ff0000');
    expect(doc.overrides['name']!.value).toBe('preserved');
  });

  it('does not mutate the input doc', () => {
    const original = createOverridesDoc(UMBRELLA_URL, BASE_DIGEST);
    setOverride(original, 'name', 'x');
    expect(Object.keys(original.overrides)).toHaveLength(0);
  });
});

describe('forgetOverride', () => {
  it('marks an active entry as superseded: true', () => {
    let doc = createOverridesDoc(UMBRELLA_URL, BASE_DIGEST);
    doc = setOverride(doc, 'name', 'old');
    doc = forgetOverride(doc, 'name');
    expect(doc.overrides['name']!.superseded).toBe(true);
  });

  it('preserves the entry in the overrides record (does not delete it)', () => {
    let doc = createOverridesDoc(UMBRELLA_URL, BASE_DIGEST);
    doc = setOverride(doc, 'name', 'old');
    doc = forgetOverride(doc, 'name');
    expect('name' in doc.overrides).toBe(true);
    expect(doc.overrides['name']!.value).toBe('old');
  });

  it('is a no-op when the path has no override', () => {
    const doc = createOverridesDoc(UMBRELLA_URL, BASE_DIGEST);
    const unchanged = forgetOverride(doc, 'nonexistent');
    expect(unchanged).toBe(doc);
  });

  it('does not mutate the input doc', () => {
    let doc = createOverridesDoc(UMBRELLA_URL, BASE_DIGEST);
    doc = setOverride(doc, 'name', 'old');
    const original = doc;
    forgetOverride(doc, 'name');
    expect(original.overrides['name']!.superseded).toBeUndefined();
  });
});

describe('readOverrides + writeOverrides', () => {
  it('returns null when the file does not exist', () => {
    expect(readOverrides(join(tmpDir(), OVERRIDES_FILENAME))).toBeNull();
  });

  it('roundtrips a complete OverridesDoc', () => {
    const dir = tmpDir();
    const path = join(dir, OVERRIDES_FILENAME);
    let doc = createOverridesDoc(UMBRELLA_URL, BASE_DIGEST);
    doc = setOverride(doc, 'tokens.color.primary', '#ff0000', 'brand colour');
    writeOverrides(path, doc);
    expect(readOverrides(path)).toEqual(doc);
  });

  it('returns null for malformed JSON on disk', () => {
    const path = join(tmpDir(), OVERRIDES_FILENAME);
    writeFileSync(path, 'not json', 'utf-8');
    expect(readOverrides(path)).toBeNull();
  });

  it('returns null when the $overrides marker is absent', () => {
    const path = join(tmpDir(), OVERRIDES_FILENAME);
    writeFileSync(path, JSON.stringify({ umbrella: UMBRELLA_URL, baseDigest: BASE_DIGEST, overrides: {} }), 'utf-8');
    expect(readOverrides(path)).toBeNull();
  });
});

describe('applyOverrides', () => {
  it('returns empty heldFields and the unmodified schema when there are no active overrides', () => {
    const doc = createOverridesDoc(UMBRELLA_URL, BASE_DIGEST);
    const result = applyOverrides(BASE_SCHEMA, doc);
    expect(result.heldFields).toHaveLength(0);
    expect(result.observedValues).toEqual({});
    expect(result.schema).toEqual(BASE_SCHEMA);
  });

  it('override value replaces the umbrella value in the output schema', () => {
    const doc = setOverride(createOverridesDoc(UMBRELLA_URL, BASE_DIGEST), 'tokens.color.primary', '#override');
    const result = applyOverrides(BASE_SCHEMA, doc);
    expect((result.schema.tokens?.color as Record<string, string>)['primary']).toBe('#override');
  });

  it('umbrella value is recorded in observedValues when the override differs', () => {
    const doc = setOverride(createOverridesDoc(UMBRELLA_URL, BASE_DIGEST), 'tokens.color.primary', '#override');
    const result = applyOverrides(BASE_SCHEMA, doc);
    expect(result.heldFields).toContain('tokens.color.primary');
    expect(result.observedValues['tokens.color.primary']).toBe('#0f172a');
  });

  it('path is not added to heldFields when override value equals the umbrella value', () => {
    const same = '#0f172a';
    const doc = setOverride(createOverridesDoc(UMBRELLA_URL, BASE_DIGEST), 'tokens.color.primary', same);
    const result = applyOverrides(BASE_SCHEMA, doc);
    expect(result.heldFields).toHaveLength(0);
    expect(result.observedValues).not.toHaveProperty('tokens.color.primary');
  });

  it('non-overridden paths pass through unchanged', () => {
    const doc = setOverride(createOverridesDoc(UMBRELLA_URL, BASE_DIGEST), 'tokens.color.primary', '#override');
    const result = applyOverrides(BASE_SCHEMA, doc);
    expect(result.schema.name).toBe('umbrella');
  });

  it('superseded entries are not applied and do not appear in heldFields', () => {
    let doc = createOverridesDoc(UMBRELLA_URL, BASE_DIGEST);
    doc = setOverride(doc, 'tokens.color.primary', '#override');
    doc = forgetOverride(doc, 'tokens.color.primary');
    const result = applyOverrides(BASE_SCHEMA, doc);
    expect(result.heldFields).toHaveLength(0);
    expect((result.schema.tokens?.color as Record<string, string>)['primary']).toBe('#0f172a');
  });

  it('deep dot-notation path correctly writes a value multiple levels into the schema', () => {
    const schema = { ...BASE_SCHEMA } as unknown as VbrandType;
    const doc = setOverride(createOverridesDoc(UMBRELLA_URL, BASE_DIGEST), 'tokens.color.primary', '#deep');
    const result = applyOverrides(schema, doc);
    expect((result.schema as unknown as Record<string, unknown> & { tokens: { color: { primary: string } } }).tokens.color.primary).toBe('#deep');
  });

  it('override for a path absent in the umbrella schema inserts the value', () => {
    const doc = setOverride(createOverridesDoc(UMBRELLA_URL, BASE_DIGEST), 'brand.custom', 'injected');
    const result = applyOverrides(BASE_SCHEMA, doc);
    expect((result.schema as unknown as Record<string, unknown>)['brand']).toEqual({ custom: 'injected' });
  });
});

describe('activeOverrideCount', () => {
  it('counts only non-superseded entries', () => {
    let doc = createOverridesDoc(UMBRELLA_URL, BASE_DIGEST);
    doc = setOverride(doc, 'a', 1);
    doc = setOverride(doc, 'b', 2);
    doc = forgetOverride(doc, 'a');
    expect(activeOverrideCount(doc)).toBe(1);
  });

  it('returns zero for an empty overrides record', () => {
    expect(activeOverrideCount(createOverridesDoc(UMBRELLA_URL, BASE_DIGEST))).toBe(0);
  });

  it('returns zero when all entries are superseded', () => {
    let doc = createOverridesDoc(UMBRELLA_URL, BASE_DIGEST);
    doc = setOverride(doc, 'a', 1);
    doc = forgetOverride(doc, 'a');
    expect(activeOverrideCount(doc)).toBe(0);
  });

  it('counts all non-superseded entries regardless of their values', () => {
    let doc = createOverridesDoc(UMBRELLA_URL, BASE_DIGEST);
    doc = setOverride(doc, 'a', 1);
    doc = setOverride(doc, 'b', 'string');
    doc = setOverride(doc, 'c', null);
    expect(activeOverrideCount(doc)).toBe(3);
  });
});
