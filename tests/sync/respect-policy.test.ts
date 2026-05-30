// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { generateKeyPair } from '../../src/lib/sync/sign.js';
import { digestJson } from '../../src/lib/sync/digest.js';
import { runSyncInit, runSyncPull } from '../../src/lib/sync/pull.js';
import { computeSyncStatus } from '../../src/lib/sync/status.js';
import {
  writeOverrides,
  createOverridesDoc,
  setOverride,
  OVERRIDES_FILENAME,
} from '../../src/lib/sync/overrides.js';
import { readLog } from '../../src/lib/sync/log.js';
import { syncLogPath } from '../../src/lib/sync/config.js';
import { makeTmpDir, publishBundle, writeSeedSchema, UMBRELLA_SCHEMA } from './fixture.js';

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

const V1_SCHEMA = { ...UMBRELLA_SCHEMA, tokens: { color: { primary: '#0070f3' }, type: {} } };
const V2_SCHEMA = { ...V1_SCHEMA, tokens: { color: { primary: '#1e40af' }, type: {} } };

describe('respect policy — override wins when umbrella publishes a new value', () => {
  let cwd: string;
  let kp: ReturnType<typeof generateKeyPair>;
  let distDir: string;

  beforeEach(async () => {
    cwd = makeTmpDir('vbrand-policy-');
    dirs.push(cwd);
    kp = generateKeyPair();
    distDir = join(cwd, 'dist');

    const umbrellaUrl = publishBundle(distDir, V1_SCHEMA, kp);
    writeSeedSchema(cwd, V1_SCHEMA);
    await runSyncInit({ cwd, umbrellaUrl });
    await runSyncPull({ cwd });
  });

  it('override field is unchanged after umbrella publishes a new value', async () => {
    const doc = setOverride(
      createOverridesDoc(`file://${distDir}`, digestJson(V1_SCHEMA)),
      'tokens.color.primary',
      '#0070f3',
      'legacy blue for screenshots',
    );
    writeOverrides(join(cwd, OVERRIDES_FILENAME), doc);

    publishBundle(distDir, V2_SCHEMA, kp);
    const result = await runSyncPull({ cwd });

    const schema = JSON.parse(readFileSync(join(cwd, 'vbrand.schema.json'), 'utf-8')) as { tokens: { color: { primary: string } } };
    expect(schema.tokens.color.primary).toBe('#0070f3');
    expect(result.fieldsHeld).toContain('tokens.color.primary');
  });

  it('non-overridden fields adopt the umbrella value', async () => {
    const updatedWithNewName = { ...V2_SCHEMA, name: 'umbrella-v2' };
    writeOverrides(
      join(cwd, OVERRIDES_FILENAME),
      setOverride(createOverridesDoc(`file://${distDir}`, digestJson(V1_SCHEMA)), 'tokens.color.primary', '#0070f3'),
    );

    publishBundle(distDir, updatedWithNewName, kp);
    await runSyncPull({ cwd });

    const schema = JSON.parse(readFileSync(join(cwd, 'vbrand.schema.json'), 'utf-8')) as { name: string };
    expect(schema.name).toBe('umbrella-v2');
  });

  it('force policy overwrites the override field with the umbrella value', async () => {
    writeOverrides(
      join(cwd, OVERRIDES_FILENAME),
      setOverride(createOverridesDoc(`file://${distDir}`, digestJson(V1_SCHEMA)), 'tokens.color.primary', '#0070f3'),
    );

    publishBundle(distDir, V2_SCHEMA, kp);
    await runSyncPull({ cwd, forcePolicy: 'force' });

    const schema = JSON.parse(readFileSync(join(cwd, 'vbrand.schema.json'), 'utf-8')) as { tokens: { color: { primary: string } } };
    expect(schema.tokens.color.primary).toBe('#1e40af');
  });

  it('sync status is code 2 (ahead) when an active override diverges from umbrella', async () => {
    writeOverrides(
      join(cwd, OVERRIDES_FILENAME),
      setOverride(createOverridesDoc(`file://${distDir}`, digestJson(V1_SCHEMA)), 'tokens.color.primary', '#0070f3'),
    );

    publishBundle(distDir, V2_SCHEMA, kp);
    await runSyncPull({ cwd });

    const status = await computeSyncStatus({ cwd });
    expect(status.code).toBe(2);
    expect(status.ahead).toBe(true);
    expect(status.heldFields).toContain('tokens.color.primary');
  });

  it('pull result reports fieldsHeld and fieldsAdopted', async () => {
    writeOverrides(
      join(cwd, OVERRIDES_FILENAME),
      setOverride(createOverridesDoc(`file://${distDir}`, digestJson(V1_SCHEMA)), 'tokens.color.primary', '#0070f3'),
    );

    publishBundle(distDir, V2_SCHEMA, kp);
    const result = await runSyncPull({ cwd });

    expect(result.fieldsHeld).toContain('tokens.color.primary');
    expect(result.fieldsHeld.length).toBeGreaterThanOrEqual(1);
    expect(result.fieldsAdopted).toBeGreaterThanOrEqual(0);
  });

  it('log records the observed-but-not-adopted umbrella value and timestamp', async () => {
    writeOverrides(
      join(cwd, OVERRIDES_FILENAME),
      setOverride(createOverridesDoc(`file://${distDir}`, digestJson(V1_SCHEMA)), 'tokens.color.primary', '#0070f3'),
    );

    publishBundle(distDir, V2_SCHEMA, kp);
    await runSyncPull({ cwd });

    const pullEntry = [...readLog(syncLogPath(cwd))].reverse().find((e) => e.op === 'pull');
    expect(pullEntry).toBeDefined();
    expect(pullEntry!.fieldsHeld).toContain('tokens.color.primary');
    expect(pullEntry!.observedValues?.['tokens.color.primary']).toBe('#1e40af');
    expect(pullEntry!.at).toBeTruthy();
  });
});
