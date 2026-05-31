// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { afterAll, describe, expect, it } from 'vitest';
import { runFuse } from '../../src/commands/fuse.js';
import { runEmit } from '../../src/commands/emit.js';
import { runInitCi } from '../../src/commands/init-ci.js';
import { runDeploy } from '../../src/commands/deploy.js';
import { VbrandSchema, SCHEMA_FILENAME } from '../../src/schema.js';
import {
  BASELINE_CACHE_REL_DIR,
  BASELINE_NAME,
  BASELINE_VOICE_CANONICAL,
} from '../../src/lib/baseline/schema-values.js';


const STRIPE_FIXTURE_PATH = resolve(
  new URL('../../examples/demo/stripe-com.candidate.json', import.meta.url).pathname,
);


const dirs: string[] = [];
afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });

function makeWorkspace(): string {
  const d = mkdtempSync(join(tmpdir(), 'vbrand-e2e-031-'));
  dirs.push(d);
  return d;
}

async function writeTestFavicon(dir: string): Promise<string> {
  const p = join(dir, 'test-favicon.png');
  await sharp({
    create: { width: 64, height: 64, channels: 4, background: { r: 99, g: 102, b: 241, alpha: 255 } },
  }).png().toFile(p);
  return p;
}

function patchCandidateFaviconSource(fixturePath: string, localFaviconPath: string): unknown {
  const raw      = readFileSync(fixturePath, 'utf-8');
  const doc      = JSON.parse(raw) as Record<string, unknown>;
  const fields   = doc['fields']  as Record<string, unknown>;
  const favField = fields['favicon'] as Record<string, unknown>;
  const favValue = favField['value'] as Record<string, unknown>;
  favValue['source'] = localFaviconPath;
  return doc;
}

async function prepareCandidateFile(dir: string): Promise<string> {
  const faviconPath   = await writeTestFavicon(dir);
  const patchedDoc    = patchCandidateFaviconSource(STRIPE_FIXTURE_PATH, faviconPath);
  const candidatePath = join(dir, 'stripe-com.candidate.json');
  writeFileSync(candidatePath, JSON.stringify(patchedDoc, null, 2), 'utf-8');
  return candidatePath;
}


describe('fuse --inject-baseline: full pipeline sequence (offline-deterministic)', () => {
  it('fuse → emit → init-ci → deploy --dry-run all resolve without error', async () => {
    const dir           = makeWorkspace();
    const candidatePath = await prepareCandidateFile(dir);

    const fuseResult = await runFuse([candidatePath], {
      cwd: dir,
      injectBaseline: true,
      strategy: 'umbrella-wins',
    });
    expect(fuseResult.schemaPath).toBe(join(dir, SCHEMA_FILENAME));
    expect(VbrandSchema.safeParse(fuseResult.schema).success).toBe(true);

    const emitResult = await runEmit({ cwd: dir });
    expect(emitResult.files.length).toBeGreaterThan(0);

    const initResult = await runInitCi({ forge: 'github', cwd: dir });
    expect(initResult.written.length).toBeGreaterThan(0);
    expect(existsSync(join(dir, 'vbrand.deploy.json'))).toBe(true);

    const deployResult = await runDeploy({ dryRun: true, cwd: dir });
    expect(deployResult.ok).toBe(true);
    expect(deployResult.liveUrl).toBeTruthy();
  });
});

// Verifies the structural gap that --inject-baseline closes:
// real-URL HTML candidates commonly expose name/voice/favicon but NOT
// colors, type tokens, or icons.  Baseline must fill those silently.

describe('fuse --inject-baseline: absent fields in real-URL candidate are filled by baseline', () => {
  it('tokens.color and tokens.type are defined when candidate does not provide them', async () => {
    const dir           = makeWorkspace();
    const candidatePath = await prepareCandidateFile(dir);
    const r = await runFuse([candidatePath], { cwd: dir, injectBaseline: true });

    expect(r.schema.tokens.color['primary']).toBeDefined();
    expect(r.schema.tokens.type['body']).toBeDefined();
    expect(VbrandSchema.safeParse(r.schema).success).toBe(true);
  });

  it('icons.source comes from baseline when candidate does not provide it', async () => {
    const dir           = makeWorkspace();
    const candidatePath = await prepareCandidateFile(dir);
    const r = await runFuse([candidatePath], { cwd: dir, injectBaseline: true });

    expect(r.schema.assets.icons.source).toContain(BASELINE_CACHE_REL_DIR);
  });
});

// High-confidence real-URL candidate fields must not be overwritten by
// baseline values, regardless of which fields the baseline provides.

describe('fuse --inject-baseline: real-URL candidate high-confidence fields are not overwritten by baseline', () => {
  it('name and voice fields from candidate differ from baseline sentinel values', async () => {
    const dir           = makeWorkspace();
    const candidatePath = await prepareCandidateFile(dir);
    const r = await runFuse([candidatePath], { cwd: dir, injectBaseline: true });

    expect(r.schema.name).not.toBe(BASELINE_NAME);
    expect(r.schema.voice.canonical).not.toBe(BASELINE_VOICE_CANONICAL);
  });

  it('name and voice fields are non-empty strings from the candidate', async () => {
    const dir           = makeWorkspace();
    const candidatePath = await prepareCandidateFile(dir);
    const r = await runFuse([candidatePath], { cwd: dir, injectBaseline: true });

    expect(r.schema.name.length).toBeGreaterThan(0);
    expect(r.schema.voice.canonical.length).toBeGreaterThan(0);
    expect(r.schema.voice.repoDescription.length).toBeGreaterThan(0);
  });
});


describe('fuse --inject-baseline: deterministic output', () => {
  it('two consecutive fuse calls produce byte-equal vbrand.schema.json', async () => {
    const dir           = makeWorkspace();
    const candidatePath = await prepareCandidateFile(dir);

    await runFuse([candidatePath], { cwd: dir, injectBaseline: true });
    const first = readFileSync(join(dir, SCHEMA_FILENAME), 'utf-8');

    await runFuse([candidatePath], { cwd: dir, injectBaseline: true });
    const second = readFileSync(join(dir, SCHEMA_FILENAME), 'utf-8');

    expect(first).toBe(second);
  });
});
