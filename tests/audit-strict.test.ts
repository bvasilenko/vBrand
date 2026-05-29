// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterAll, describe, expect, it } from 'vitest';
import { runAudit } from '../src/commands/audit.js';
import { runEmit } from '../src/commands/emit.js';
import { SCHEMA_FILENAME } from '../src/schema.js';

const dirs: string[] = [];
afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); }, 60000);

const SCHEMA = {
  name: 'audit-strict-test',
  voice: { canonical: 'Test.', repoDescription: 'Strict audit test.' },
  assets: {
    favicon: { source: 'logo.png', sizes: [32] },
    og: { dimensions: [1200, 630] as [number, number] },
    icons: { source: 'icons/', set: [] },
  },
  tokens: { color: { primary: '#0f172a' }, type: {} },
};

const SCHEMA_WITH_PLACEHOLDER_SLOT = {
  ...SCHEMA,
  slots: {
    tagline: {
      placeholder: 'Your tagline here',
      value: 'Your tagline here',
    },
  },
};

async function createCleanProject(overrideSchema?: object): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), 'vbrand-strict-'));
  dirs.push(dir);
  await sharp({
    create: { width: 64, height: 64, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 255 } },
  }).png().toFile(join(dir, 'logo.png'));
  writeFileSync(
    join(dir, SCHEMA_FILENAME),
    JSON.stringify(overrideSchema ?? SCHEMA),
    'utf-8',
  );
  await runEmit({ cwd: dir });
  return dir;
}

describe('audit --strict exits 1 on drift (acceptance #21)', () => {
  it('detects modified favicon and exits with drifted finding', async () => {
    const dir = await createCleanProject();
    writeFileSync(join(dir, 'public', 'brand', 'favicons', 'favicon-32.png'), Buffer.from('bad'));
    const result = await runAudit({ cwd: dir, strict: true });
    expect(result.clean).toBe(false);
    expect(result.drifted.length).toBeGreaterThan(0);
  });

  it('detects placeholder slot', async () => {
    const dir = await createCleanProject(SCHEMA_WITH_PLACEHOLDER_SLOT);
    const result = await runAudit({ cwd: dir });
    expect(result.slotFindings.length).toBeGreaterThan(0);
    expect(result.slotFindings[0]?.reason).toBe('placeholder');
  });

  it('detects heading skip via axe-core when HTML file present', async () => {
    const dir = await createCleanProject();
    const badHtml = `<!DOCTYPE html><html><head><title>T</title></head><body>
      <h1>Title</h1>
      <h3>Skipped h2!</h3>
    </body></html>`;
    writeFileSync(join(dir, 'public', 'brand', 'page.html'), badHtml, 'utf-8');
    const result = await runAudit({ cwd: dir });
    const headingFinding = result.axeFindings.find((f) => f.ruleId === 'heading-order');
    expect(headingFinding).toBeDefined();
  });

  it('detects missing alt on img via axe-core', async () => {
    const dir = await createCleanProject();
    const badHtml = `<!DOCTYPE html><html><head><title>T</title></head><body>
      <img src="logo.png" />
    </body></html>`;
    writeFileSync(join(dir, 'public', 'brand', 'test.html'), badHtml, 'utf-8');
    const result = await runAudit({ cwd: dir });
    const altFinding = result.axeFindings.find((f) => f.ruleId === 'image-alt');
    expect(altFinding).toBeDefined();
  });

  it('writes reports/audit-DATE.md', async () => {
    const dir = await createCleanProject();
    const result = await runAudit({ cwd: dir });
    expect(result.reportPath).toBeDefined();
    expect(existsSync(result.reportPath!)).toBe(true);
  });

  it('clean project reports clean:true', async () => {
    const dir = await createCleanProject();
    const result = await runAudit({ cwd: dir, strict: true });
    expect(result.clean).toBe(true);
    expect(result.drifted).toHaveLength(0);
    expect(result.axeFindings).toHaveLength(0);
    expect(result.slotFindings).toHaveLength(0);
  });
});
