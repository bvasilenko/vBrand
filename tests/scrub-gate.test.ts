// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { loadScrubPatterns, runScrubGate } from '../src/lib/scrub-gate.js';

const dirs: string[] = [];
afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });

function tmpScrubList(content: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'vbrand-scrub-'));
  dirs.push(dir);
  const p = join(dir, 'scrub-list.txt');
  writeFileSync(p, content, 'utf-8');
  return p;
}

describe('loadScrubPatterns - file parsing', () => {
  it('returns patterns for each non-blank, non-comment line', () => {
    const p = tmpScrubList('acme\nbeta-brand\n');
    expect(loadScrubPatterns(p)).toEqual(['acme', 'beta-brand']);
  });

  it('strips inline comments after #', () => {
    const p = tmpScrubList('acme # internal brand name\n');
    expect(loadScrubPatterns(p)).toEqual(['acme']);
  });

  it('ignores full-line comments', () => {
    const p = tmpScrubList('# this is a comment\nacme\n');
    expect(loadScrubPatterns(p)).toEqual(['acme']);
  });

  it('ignores blank lines', () => {
    const p = tmpScrubList('\nacme\n\nbeta\n\n');
    expect(loadScrubPatterns(p)).toEqual(['acme', 'beta']);
  });

  it('normalises patterns to lowercase', () => {
    const p = tmpScrubList('ACME\nBeta-Brand\n');
    expect(loadScrubPatterns(p)).toEqual(['acme', 'beta-brand']);
  });

  it('returns empty array for a file with only comments and blanks', () => {
    const p = tmpScrubList('# just a comment\n\n# another\n');
    expect(loadScrubPatterns(p)).toEqual([]);
  });

  it('trims surrounding whitespace from each pattern', () => {
    const p = tmpScrubList('  acme  \n  beta  \n');
    expect(loadScrubPatterns(p)).toEqual(['acme', 'beta']);
  });
});

describe('runScrubGate - no findings', () => {
  it('returns empty array when patterns list is empty', () => {
    expect(runScrubGate({ name: 'acme' }, [])).toEqual([]);
  });

  it('returns empty array when data has no matching strings', () => {
    expect(runScrubGate({ name: 'acme' }, ['beta'])).toEqual([]);
  });

  it('returns empty array for null data', () => {
    expect(runScrubGate(null, ['acme'])).toEqual([]);
  });

  it('returns empty array for empty object', () => {
    expect(runScrubGate({}, ['acme'])).toEqual([]);
  });
});

describe('runScrubGate - matching', () => {
  it('detects a pattern in a top-level string value', () => {
    const findings = runScrubGate({ name: 'acme-brand' }, ['acme']);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.pattern).toBe('acme');
  });

  it('matching is case-insensitive against field values', () => {
    const findings = runScrubGate({ name: 'ACME Corp' }, ['acme']);
    expect(findings).toHaveLength(1);
  });

  it('detects pattern in nested object field', () => {
    const data = { brand: { description: 'powered by acme engine' } };
    const findings = runScrubGate(data, ['acme']);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.field).toBe('brand.description');
  });

  it('detects pattern in array element', () => {
    const data = { tags: ['open-source', 'acme-internal', 'fast'] };
    const findings = runScrubGate(data, ['acme']);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.field).toBe('tags[1]');
  });

  it('reports all matching fields independently', () => {
    const data = { a: 'acme thing', b: 'acme other' };
    const findings = runScrubGate(data, ['acme']);
    expect(findings).toHaveLength(2);
  });

  it('reports finding for each matching pattern on the same value', () => {
    const data = { name: 'acme-beta' };
    const findings = runScrubGate(data, ['acme', 'beta']);
    expect(findings).toHaveLength(2);
    const patterns = findings.map((f) => f.pattern);
    expect(patterns).toContain('acme');
    expect(patterns).toContain('beta');
  });
});

describe('runScrubGate - finding shape', () => {
  it('finding has field, value, and pattern properties', () => {
    const findings = runScrubGate({ key: 'acme' }, ['acme']);
    expect(findings[0]).toMatchObject({
      field: 'key',
      value: expect.any(String),
      pattern: 'acme',
    });
  });

  it('value is truncated to 120 characters maximum', () => {
    const long = 'acme ' + 'x'.repeat(200);
    const findings = runScrubGate({ v: long }, ['acme']);
    expect(findings[0]!.value.length).toBeLessThanOrEqual(120);
  });

  it('top-level string root path is empty string', () => {
    const findings = runScrubGate('acme', ['acme']);
    expect(findings[0]!.field).toBe('');
  });
});

describe('runScrubGate - nested array of objects', () => {
  it('traverses arrays of objects', () => {
    const data = { items: [{ label: 'clean' }, { label: 'acme brand' }] };
    const findings = runScrubGate(data, ['acme']);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.field).toBe('items[1].label');
  });
});
