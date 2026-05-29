// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { emitDesignDoc } from '../src/lib/emit/design-doc.js';
import { writeAuditReport, AuditReportData } from '../src/lib/audit/report.js';
import { emitCssVars } from '../src/lib/emit/css-vars.js';
import { buildRegistryItem } from '../src/lib/publish/registry-item.js';
import { writeNpmShape } from '../src/lib/publish/npm-shape.js';
import type { VbrandType } from '../src/schema.js';
import { buildCandidateDoc, emptyFields } from '../src/lib/pull/candidate.js';
import { highField } from '../src/lib/pull/confidence.js';
import { runScrubGate } from '../src/lib/scrub-gate.js';

const EM_DASH = '—';
// U+1F1E0..U+1F1FF regional-indicator pairs encode national flag sequences.
const FLAG_RE = /[\u{1F1E0}-\u{1F1FF}]{2}/u;

const dirs: string[] = [];
afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });

const SCHEMA: VbrandType = {
  name: 'voice-gate-test',
  voice: { canonical: 'Terse. Technical. Precise.', repoDescription: 'Brand contract test.' },
  assets: {
    favicon: { source: 'logo.png', sizes: [32] },
    og: { dimensions: [1200, 630] },
    icons: { source: 'icons/', set: [] },
  },
  tokens: { color: { primary: '#0f172a' }, type: {} },
};

function tmpDir(): string {
  const d = mkdtempSync(join(tmpdir(), 'vbrand-voice-'));
  dirs.push(d);
  return d;
}

function assertNoEmDash(content: string, label: string): void {
  expect(content, `em-dash found in ${label}`).not.toContain(EM_DASH);
}

function assertNoFlagEmoji(content: string, label: string): void {
  expect(FLAG_RE.test(content), `national flag emoji found in ${label}`).toBe(false);
}

describe('voice gate: no em-dashes in emitted prose (§gate 5)', () => {
  it('DESIGN.md contains no em-dash', () => {
    const dir = tmpDir();
    const outPath = emitDesignDoc(SCHEMA, dir);
    const content = readFileSync(outPath, 'utf-8');
    assertNoEmDash(content, 'DESIGN.md');
  });

  it('audit report contains no em-dash', () => {
    const dir = tmpDir();
    const data: AuditReportData = {
      schemaPath: 'vbrand.schema.json',
      drifted: [],
      axeFindings: [],
      slotFindings: [],
      alignmentDrifts: [],
      strict: false,
      exitCode: 0,
    };
    const outPath = writeAuditReport(data, join(dir, 'reports'));
    const content = readFileSync(outPath, 'utf-8');
    assertNoEmDash(content, 'audit report');
  });

  it('brand-tokens.css contains no em-dash', () => {
    const dir = tmpDir();
    const outPath = emitCssVars(SCHEMA, dir);
    const content = readFileSync(outPath, 'utf-8');
    assertNoEmDash(content, 'brand-tokens.css');
  });

  it('registry-item description contains no em-dash', () => {
    const item = buildRegistryItem(SCHEMA, '0.2.0');
    assertNoEmDash(item.description, 'registry-item.description');
  });

  it('npm README contains no em-dash', () => {
    const dir = tmpDir();
    const paths = writeNpmShape(SCHEMA, '0.2.0', dir);
    const readmePath = paths.find((p) => p.endsWith('README.md'));
    if (!readmePath) throw new Error('npm shape did not write README.md');
    const content = readFileSync(readmePath, 'utf-8');
    assertNoEmDash(content, 'npm/README.md');
  });
});

describe('voice gate: no prohibited flag references in emitted prose (§gate 5)', () => {
  it('DESIGN.md contains no national flag emoji', () => {
    const dir = tmpDir();
    const outPath = emitDesignDoc(SCHEMA, dir);
    const content = readFileSync(outPath, 'utf-8');
    assertNoFlagEmoji(content, 'DESIGN.md');
  });

  it('audit report contains no national flag emoji', () => {
    const dir = tmpDir();
    const data: AuditReportData = {
      schemaPath: 'vbrand.schema.json',
      drifted: [],
      axeFindings: [],
      slotFindings: [],
      alignmentDrifts: [],
      strict: false,
      exitCode: 0,
    };
    const outPath = writeAuditReport(data, join(dir, 'reports'));
    const content = readFileSync(outPath, 'utf-8');
    assertNoFlagEmoji(content, 'audit report');
  });

  it('registry-item description contains no national flag emoji', () => {
    const item = buildRegistryItem(SCHEMA, '0.2.0');
    assertNoFlagEmoji(item.description, 'registry-item.description');
  });

  it('npm README contains no national flag emoji', () => {
    const dir = tmpDir();
    const paths = writeNpmShape(SCHEMA, '0.2.0', dir);
    const readmePath = paths.find((p) => p.endsWith('README.md'));
    if (!readmePath) throw new Error('npm shape did not write README.md');
    const content = readFileSync(readmePath, 'utf-8');
    assertNoFlagEmoji(content, 'npm/README.md');
  });
});

describe('voice gate: pull candidate schema authored fields (§gate 5)', () => {
  it('buildCandidateDoc voice fields contain no em-dash', () => {
    const doc = buildCandidateDoc('gh-acme', 'gh:acme', {
      ...emptyFields(),
      name: highField('Acme Corp', 'test'),
      voiceCanonical: highField('Acme Corp', 'test'),
      voiceDescription: highField('Acme Corp', 'test'),
    });
    assertNoEmDash(doc.fields.voiceCanonical.value ?? '', 'candidate.voiceCanonical');
    assertNoEmDash(doc.fields.voiceDescription.value ?? '', 'candidate.voiceDescription');
    assertNoEmDash(doc.fields.name.value ?? '', 'candidate.name');
  });

  it('buildCandidateDoc voice fields contain no national flag emoji', () => {
    const doc = buildCandidateDoc('gh-acme', 'gh:acme', {
      ...emptyFields(),
      name: highField('Acme Corp', 'test'),
      voiceCanonical: highField('Acme Corp', 'test'),
    });
    assertNoFlagEmoji(doc.fields.voiceCanonical.value ?? '', 'candidate.voiceCanonical');
    assertNoFlagEmoji(doc.fields.name.value ?? '', 'candidate.name');
  });
});

describe('voice gate: fuse scrub finding descriptions (§gate 5)', () => {
  it('finding field path is plain ASCII even when the matched value contains an em-dash', () => {
    const sourceWithEmDash = { voice: { canonical: 'Innovative—brand voice.' } };
    const findings = runScrubGate(sourceWithEmDash, ['innovative']);
    expect(findings).toHaveLength(1);
    assertNoEmDash(findings[0]!.field, 'finding.field path');
  });

  it('finding pattern label is plain ASCII even when the matched value contains an em-dash', () => {
    const sourceWithEmDash = { tokens: { color: { primary: 'Innovative—token' } } };
    const findings = runScrubGate(sourceWithEmDash, ['innovative']);
    expect(findings).toHaveLength(1);
    assertNoEmDash(findings[0]!.pattern, 'finding.pattern label');
  });

  it('finding field path contains no national flag emoji', () => {
    const data = { voice: { canonical: 'Test voice.' } };
    const findings = runScrubGate(data, ['test']);
    expect(findings).toHaveLength(1);
    assertNoFlagEmoji(findings[0]!.field, 'finding.field path');
  });
});
