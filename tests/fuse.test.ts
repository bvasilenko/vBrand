// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { runFuse } from '../src/commands/fuse.js';
import { mergePatch, applyMergePatchSequence } from '../src/lib/fuse/merge-patch.js';
import { applyStrategy } from '../src/lib/fuse/strategies.js';
import { buildCandidateDoc, emptyFields } from '../src/lib/pull/candidate.js';
import { highField } from '../src/lib/pull/confidence.js';
import type { CandidateDoc } from '../src/lib/pull/candidate-schema.js';

const dirs: string[] = [];
afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });

const SCHEMA_A = {
  name: 'umbrella',
  voice: { canonical: 'Umbrella voice.', repoDescription: 'Umbrella.' },
  assets: {
    favicon: { source: 'logo.png', sizes: [32, 180] },
    og: { dimensions: [1200, 630] },
    icons: { source: 'icons/', set: ['check'] },
  },
  tokens: { color: { primary: '#0f172a', accent: '#6366f1' }, type: {} },
};

const SCHEMA_B = {
  name: 'sub',
  voice: { canonical: 'Sub voice.', repoDescription: 'Sub.' },
  assets: {
    favicon: { source: 'logo-sub.png', sizes: [16, 32] },
    og: { dimensions: [1200, 630] },
    icons: { source: 'icons/', set: [] },
  },
  tokens: { color: { primary: '#ffffff', secondary: '#cccccc' }, type: {} },
};

function writeSchema(dir: string, name: string, data: object): string {
  const p = join(dir, `${name}.json`);
  writeFileSync(p, JSON.stringify(data, null, 2), 'utf-8');
  return p;
}

function candidateFrom(
  name: string,
  voice: { canonical: string; repoDescription: string },
  tokens: { color: Record<string, string>; type: Record<string, string> },
  assets: {
    favicon: { source: string; sizes: number[] };
    og: { dimensions: [number, number] };
    icons: { source: string; set: string[] };
  },
  sourceUri = 'local:test',
): CandidateDoc {
  return buildCandidateDoc(sourceUri.replace(/[^a-z0-9]/gi, '-'), sourceUri, {
    ...emptyFields(),
    name:             highField(name, 'local-field'),
    voiceCanonical:   highField(voice.canonical, 'local-field'),
    voiceDescription: highField(voice.repoDescription, 'local-field'),
    colors:           highField(tokens.color, 'local-field'),
    typeTokens:       highField(tokens.type, 'local-field'),
    favicon:          highField(assets.favicon, 'local-field'),
    og:               highField(assets.og, 'local-field'),
    icons:            highField(assets.icons, 'local-field'),
  });
}

function writeCandidateFile(dir: string, name: string, doc: CandidateDoc): string {
  const p = join(dir, `${name}.candidate.json`);
  writeFileSync(p, JSON.stringify(doc, null, 2), 'utf-8');
  return p;
}

describe('mergePatch - RFC 7396 compliance', () => {
  it('non-conflicting keys are merged', () => {
    const result = mergePatch({ a: 1 }, { b: 2 });
    expect(result).toEqual({ a: 1, b: 2 });
  });

  it('patch value replaces target value', () => {
    const result = mergePatch({ a: 1 }, { a: 2 });
    expect(result).toEqual({ a: 2 });
  });

  it('null in patch deletes key from target', () => {
    const result = mergePatch({ a: 1, b: 2 }, { a: null });
    expect(result).toEqual({ b: 2 });
  });

  it('arrays in patch replace arrays in target', () => {
    const result = mergePatch({ arr: [1, 2, 3] }, { arr: [4, 5] });
    expect(result).toEqual({ arr: [4, 5] });
  });

  it('nested objects are recursively merged', () => {
    const result = mergePatch({ a: { x: 1, y: 2 } }, { a: { y: 99, z: 3 } });
    expect(result).toEqual({ a: { x: 1, y: 99, z: 3 } });
  });

  it('non-object patch replaces target entirely', () => {
    expect(mergePatch({ a: 1 }, 42)).toBe(42);
    expect(mergePatch({ a: 1 }, 'string')).toBe('string');
  });

  it('sequence applies patches in order (last wins)', () => {
    const result = applyMergePatchSequence([{ a: 1 }, { a: 2 }, { b: 3 }]);
    expect(result).toEqual({ a: 2, b: 3 });
  });
});

describe('applyStrategy - umbrella-wins', () => {
  it('first schema wins on conflicting keys', () => {
    const result = applyStrategy([SCHEMA_A, SCHEMA_B], 'umbrella-wins') as typeof SCHEMA_A;
    expect(result.name).toBe(SCHEMA_A.name);
    expect(result.tokens.color['primary']).toBe(SCHEMA_A.tokens.color['primary']);
  });

  it('non-conflicting keys from B are present in result', () => {
    const result = applyStrategy([SCHEMA_A, SCHEMA_B], 'umbrella-wins') as typeof SCHEMA_A;
    expect((result.tokens.color as Record<string, string>)['secondary']).toBeDefined();
  });
});

describe('applyStrategy - merge-patch (last wins)', () => {
  it('last schema wins on conflicting keys', () => {
    const result = applyStrategy([SCHEMA_A, SCHEMA_B], 'merge-patch') as typeof SCHEMA_B;
    expect(result.name).toBe(SCHEMA_B.name);
    expect(result.tokens.color['primary']).toBe(SCHEMA_B.tokens.color['primary']);
  });
});

describe('applyStrategy - cascade (array union)', () => {
  it('arrays are unioned across schemas', () => {
    const result = applyStrategy([SCHEMA_A, SCHEMA_B], 'cascade') as typeof SCHEMA_A;
    const sizes = (result.assets.favicon as { sizes: number[] }).sizes;
    expect(sizes).toContain(16);
    expect(sizes).toContain(32);
    expect(sizes).toContain(180);
  });
});

describe('runFuse - file-based integration (candidate doc inputs)', () => {
  const docA = candidateFrom(
    'umbrella',
    { canonical: 'Umbrella voice.', repoDescription: 'Umbrella.' },
    { color: { primary: '#0f172a', accent: '#6366f1' }, type: {} },
    { favicon: { source: 'logo.png', sizes: [32, 180] }, og: { dimensions: [1200, 630] }, icons: { source: 'icons/', set: ['check'] } },
    'local:a',
  );

  const docB = candidateFrom(
    'sub',
    { canonical: 'Sub voice.', repoDescription: 'Sub.' },
    { color: { primary: '#ffffff', secondary: '#cccccc' }, type: {} },
    { favicon: { source: 'logo-sub.png', sizes: [16, 32] }, og: { dimensions: [1200, 630] }, icons: { source: 'icons/', set: [] } },
    'local:b',
  );

  it('fuses two candidate docs with umbrella-wins and writes canonical schema', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'vbrand-fuse-')); dirs.push(dir);
    const pathA = writeCandidateFile(dir, 'a', docA);
    const pathB = writeCandidateFile(dir, 'b', docB);

    const result = await runFuse([pathA, pathB], { cwd: dir, strategy: 'umbrella-wins' });
    expect(result.schema.name).toBe('umbrella');
    expect(result.strategy).toBe('umbrella-wins');
  });

  it('fuses with merge-patch strategy (last wins)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'vbrand-fuse-')); dirs.push(dir);
    const pathA = writeCandidateFile(dir, 'a', docA);
    const pathB = writeCandidateFile(dir, 'b', docB);

    const result = await runFuse([pathA, pathB], { cwd: dir, strategy: 'merge-patch' });
    expect(result.schema.name).toBe('sub');
  });

  it('fuses with cascade strategy', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'vbrand-fuse-')); dirs.push(dir);
    const pathA = writeCandidateFile(dir, 'a', docA);
    const pathB = writeCandidateFile(dir, 'b', docB);

    const result = await runFuse([pathA, pathB], { cwd: dir, strategy: 'cascade' });
    expect(result.schema).toBeDefined();
    expect(result.strategy).toBe('cascade');
  });

  it('emits scrub findings as parseable JSON when scrub-list.txt is present', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'vbrand-fuse-')); dirs.push(dir);
    const docForbidden = candidateFrom(
      'forbidden-brand',
      { canonical: 'Test.', repoDescription: 'Test.' },
      { color: { primary: '#0f172a' }, type: {} },
      { favicon: { source: 'logo.png', sizes: [32] }, og: { dimensions: [1200, 630] }, icons: { source: 'icons/', set: [] } },
      'local:forbidden',
    );
    const pathA = writeCandidateFile(dir, 'a', docForbidden);
    const pathB = writeCandidateFile(dir, 'b', docB);
    writeFileSync(join(dir, 'scrub-list.txt'), 'forbidden-brand\n', 'utf-8');

    const result = await runFuse([pathA, pathB], { cwd: dir });
    expect(result.scrubFindings.length).toBeGreaterThan(0);
    expect(JSON.parse(JSON.stringify(result.scrubFindings))).toEqual(result.scrubFindings);
  });

  it('throws when fewer than two inputs provided', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'vbrand-fuse-')); dirs.push(dir);
    const pathA = writeCandidateFile(dir, 'a', docA);
    await expect(runFuse([pathA], { cwd: dir })).rejects.toThrow('at least two');
  });

  it('throws a clear error when given a non-candidate file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'vbrand-fuse-')); dirs.push(dir);
    const plain = writeSchema(dir, 'plain', { name: 'x' });
    const pathB = writeCandidateFile(dir, 'b', docB);
    await expect(runFuse([plain, pathB], { cwd: dir })).rejects.toThrow(/not a candidate document/);
  });
});
