// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

type CellResult = {
  fixture: string;
  app: string;
  mode: string;
  stack: string;
  cms: string;
  primary: string;
  iframeSheetCount: number;
  islandCount: number;
  thumbnail: Buffer;
  error: string | null;
};

type WriteManifest = (
  results: CellResult[],
  destPath: string,
  expectedPrimaries: Record<string, string>,
) => void;

type PrintDiffReport = (
  results: CellResult[],
  expectedPrimaries: Record<string, string>,
) => void;

let writeManifest: WriteManifest;
let printDiffReport: PrintDiffReport;

beforeAll(async () => {
  const mod = await vi.importActual<{ writeManifest: WriteManifest; printDiffReport: PrintDiffReport }>(
    '../../../scripts/eye-test/diff-reporter.mjs',
  );
  ({ writeManifest, printDiffReport } = mod);
});

const EXPECTED_PRIMARIES: Record<string, string> = {
  stripe: '#635bff',
  github: '#0969da',
};

function makeResult(overrides: Partial<CellResult> = {}): CellResult {
  return {
    fixture: 'stripe',
    app: 'landing',
    mode: 'static',
    stack: 'vite',
    cms: 'payload',
    primary: '#635bff',
    iframeSheetCount: 3,
    islandCount: 0,
    thumbnail: Buffer.alloc(4),
    error: null,
    ...overrides,
  };
}

let tmpDir: string;
let manifestPath: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vbrand-diff-'));
  manifestPath = path.join(tmpDir, 'manifest.json');
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true });
});

function captureStdout(fn: () => void): string {
  const parts: string[] = [];
  vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
    parts.push(String(chunk));
    return true;
  });
  try {
    fn();
  } finally {
    vi.mocked(process.stdout.write).mockRestore();
  }
  return parts.join('');
}

describe('writeManifest - output file contract', () => {
  it('produces a valid JSON file at the given path', () => {
    writeManifest([makeResult()], manifestPath, EXPECTED_PRIMARIES);
    expect(() => JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))).not.toThrow();
  });

  it('entry count matches the number of input results', () => {
    const results = [makeResult(), makeResult({ fixture: 'github', primary: '#0969da' })];
    writeManifest(results, manifestPath, EXPECTED_PRIMARIES);
    const entries = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as unknown[];
    expect(entries).toHaveLength(results.length);
  });

  it('thumbnail field is absent from every entry', () => {
    writeManifest([makeResult(), makeResult()], manifestPath, EXPECTED_PRIMARIES);
    const entries = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as Record<string, unknown>[];
    for (const entry of entries) {
      expect('thumbnail' in entry).toBe(false);
    }
  });

  it('all other result fields (fixture, app, mode, stack, cms, primary) are preserved', () => {
    writeManifest([makeResult()], manifestPath, EXPECTED_PRIMARIES);
    const entry = (JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as Record<string, unknown>[])[0];
    expect(entry['fixture']).toBe('stripe');
    expect(entry['app']).toBe('landing');
    expect(entry['mode']).toBe('static');
    expect(entry['stack']).toBe('vite');
    expect(entry['cms']).toBe('payload');
    expect(entry['primary']).toBe('#635bff');
  });

  it('error field is null when result has no navigation error', () => {
    writeManifest([makeResult({ error: null })], manifestPath, EXPECTED_PRIMARIES);
    const entry = (JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as Record<string, unknown>[])[0];
    expect(entry['error']).toBeNull();
  });

  it('error field is preserved when non-null', () => {
    writeManifest([makeResult({ error: 'timeout after 30s' })], manifestPath, EXPECTED_PRIMARIES);
    const entry = (JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as Record<string, unknown>[])[0];
    expect(entry['error']).toBe('timeout after 30s');
  });
});

describe('writeManifest - added fields', () => {
  it('adds expectedPrimary from the expected map for known fixtures', () => {
    writeManifest([makeResult({ fixture: 'stripe' })], manifestPath, EXPECTED_PRIMARIES);
    const entry = (JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as Record<string, unknown>[])[0];
    expect(entry['expectedPrimary']).toBe('#635bff');
  });

  it('expectedPrimary is null for a fixture not in the expected map', () => {
    writeManifest([makeResult({ fixture: 'notion' })], manifestPath, EXPECTED_PRIMARIES);
    const entry = (JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as Record<string, unknown>[])[0];
    expect(entry['expectedPrimary']).toBeNull();
  });

  it('primaryMatch is true when primary matches the expected color exactly (lowercase)', () => {
    writeManifest([makeResult({ primary: '#635bff' })], manifestPath, EXPECTED_PRIMARIES);
    const entry = (JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as Record<string, unknown>[])[0];
    expect(entry['primaryMatch']).toBe(true);
  });

  it('uppercase result.primary matches a lowercase expected value', () => {
    writeManifest([makeResult({ primary: '#635BFF' })], manifestPath, { stripe: '#635bff' });
    const entry = (JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as Record<string, unknown>[])[0];
    expect(entry['primaryMatch']).toBe(true);
  });

  it('primaryMatch is false when primary color differs from expected', () => {
    writeManifest([makeResult({ primary: '#aabbcc' })], manifestPath, EXPECTED_PRIMARIES);
    const entry = (JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as Record<string, unknown>[])[0];
    expect(entry['primaryMatch']).toBe(false);
  });

  it('primaryMatch is false for a fixture absent from the expected map', () => {
    writeManifest([makeResult({ fixture: 'notion', primary: '#000000' })], manifestPath, EXPECTED_PRIMARIES);
    const entry = (JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as Record<string, unknown>[])[0];
    expect(entry['primaryMatch']).toBe(false);
  });
});

describe('printDiffReport - all-pass output', () => {
  it('emits an "All N cells passed" message when every result is clean', () => {
    const out = captureStdout(() => printDiffReport([makeResult()], EXPECTED_PRIMARIES));
    expect(out).toContain('All 1 cells passed');
  });

  it('total cell count in the pass message matches the number of results', () => {
    const results = [
      makeResult({ fixture: 'stripe', primary: '#635bff' }),
      makeResult({ fixture: 'github', primary: '#0969da' }),
    ];
    const out = captureStdout(() => printDiffReport(results, EXPECTED_PRIMARIES));
    expect(out).toContain('All 2 cells passed');
  });
});

describe('printDiffReport - failure conditions', () => {
  it('navigation error flags the cell', () => {
    const out = captureStdout(() =>
      printDiffReport([makeResult({ error: 'timeout' })], EXPECTED_PRIMARIES),
    );
    expect(out).not.toContain('All');
    expect(out).toContain('stripe/landing/static');
  });

  it('primary color mismatch flags the cell', () => {
    const out = captureStdout(() =>
      printDiffReport([makeResult({ primary: '#wrong' })], EXPECTED_PRIMARIES),
    );
    expect(out).toContain('stripe/landing/static');
  });

  it('primary color match does not flag the cell', () => {
    const out = captureStdout(() =>
      printDiffReport([makeResult({ primary: '#635bff' })], EXPECTED_PRIMARIES),
    );
    expect(out).toContain('All 1 cells passed');
  });

  it('iframe sheet count < 2 for static mode flags the cell', () => {
    const out = captureStdout(() =>
      printDiffReport([makeResult({ mode: 'static', iframeSheetCount: 1 })], EXPECTED_PRIMARIES),
    );
    expect(out).toContain('stripe/landing/static');
  });

  it('iframe sheet count = 0 for hybrid mode flags the cell', () => {
    const out = captureStdout(() =>
      printDiffReport([makeResult({ mode: 'hybrid', iframeSheetCount: 0, islandCount: 1 })], EXPECTED_PRIMARIES),
    );
    expect(out).toContain('stripe/landing/hybrid');
  });

  it('iframe sheet count >= 2 for non-spa mode does not flag the cell', () => {
    const out = captureStdout(() =>
      printDiffReport([makeResult({ mode: 'static', iframeSheetCount: 2 })], EXPECTED_PRIMARIES),
    );
    expect(out).toContain('All 1 cells passed');
  });

  it('spa mode: iframe sheet count < 2 does not flag the cell', () => {
    const out = captureStdout(() =>
      printDiffReport([makeResult({ mode: 'spa', iframeSheetCount: 0 })], EXPECTED_PRIMARIES),
    );
    expect(out).toContain('All 1 cells passed');
  });

  it('hybrid island count < 1 flags the cell', () => {
    const out = captureStdout(() =>
      printDiffReport([makeResult({ mode: 'hybrid', islandCount: 0, iframeSheetCount: 3 })], EXPECTED_PRIMARIES),
    );
    expect(out).toContain('stripe/landing/hybrid');
  });

  it('hybrid island count >= 1 does not flag the cell', () => {
    const out = captureStdout(() =>
      printDiffReport([makeResult({ mode: 'hybrid', islandCount: 1, iframeSheetCount: 3 })], EXPECTED_PRIMARIES),
    );
    expect(out).toContain('All 1 cells passed');
  });

  it('static mode: island count is not evaluated', () => {
    const out = captureStdout(() =>
      printDiffReport([makeResult({ mode: 'static', islandCount: 0, iframeSheetCount: 3 })], EXPECTED_PRIMARIES),
    );
    expect(out).toContain('All 1 cells passed');
  });

  it('spa mode: island count is not evaluated', () => {
    const out = captureStdout(() =>
      printDiffReport([makeResult({ mode: 'spa', islandCount: 0 })], EXPECTED_PRIMARIES),
    );
    expect(out).toContain('All 1 cells passed');
  });
});

describe('printDiffReport - failure entry format', () => {
  it('failure entry contains [fixture/app/mode] in square brackets', () => {
    const result = makeResult({ primary: '#wrong', fixture: 'stripe', app: 'landing', mode: 'static' });
    const out = captureStdout(() => printDiffReport([result], EXPECTED_PRIMARIES));
    expect(out).toContain('[stripe/landing/static]');
  });

  it('failure count is reported before the individual entries', () => {
    const results = [
      makeResult({ primary: '#wrong', fixture: 'stripe', app: 'landing', mode: 'static' }),
      makeResult({ primary: '#wrong2', fixture: 'github', app: 'marketing', mode: 'hybrid' }),
    ];
    const out = captureStdout(() => printDiffReport(results, EXPECTED_PRIMARIES));
    expect(out).toContain('2 cell(s)');
  });

  it('multiple failures each appear on a separate line', () => {
    const results = [
      makeResult({ primary: '#x', fixture: 'stripe', app: 'landing', mode: 'static' }),
      makeResult({ primary: '#y', fixture: 'github', app: 'docs', mode: 'spa' }),
    ];
    const out = captureStdout(() => printDiffReport(results, EXPECTED_PRIMARIES));
    expect(out).toContain('[stripe/landing/static]');
    expect(out).toContain('[github/docs/spa]');
  });

  it('clean cells are not included in the failure output', () => {
    const results = [
      makeResult({ primary: '#635bff', fixture: 'stripe' }),
      makeResult({ primary: '#wrong', fixture: 'github' }),
    ];
    const out = captureStdout(() => printDiffReport(results, EXPECTED_PRIMARIES));
    expect(out).not.toContain('[stripe/landing/static]');
    expect(out).toContain('[github/landing/static]');
  });
});

describe('printDiffReport - primary comparison is case-insensitive for result.primary', () => {
  it('uppercase primary matching a lowercase expected value does not flag the cell', () => {
    const out = captureStdout(() =>
      printDiffReport([makeResult({ primary: '#635BFF' })], { stripe: '#635bff' }),
    );
    expect(out).toContain('All 1 cells passed');
  });

  it('mixed-case primary matching the same lowercase expected value does not flag the cell', () => {
    const out = captureStdout(() =>
      printDiffReport([makeResult({ primary: '#635Bff' })], { stripe: '#635bff' }),
    );
    expect(out).toContain('All 1 cells passed');
  });

  it('uppercase primary that does not match the expected lowercase value flags the cell', () => {
    const out = captureStdout(() =>
      printDiffReport([makeResult({ primary: '#AABBCC' })], { stripe: '#635bff' }),
    );
    expect(out).toContain('stripe/landing/static');
  });
});
