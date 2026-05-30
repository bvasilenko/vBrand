// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { generateKeyPair } from '../../src/lib/sync/sign.js';
import { digestJson } from '../../src/lib/sync/digest.js';
import { runSyncInit, runSyncPull } from '../../src/lib/sync/pull.js';
import { computeSyncStatus } from '../../src/lib/sync/status.js';
import {
  writeOverrides,
  createOverridesDoc,
  setOverride,
  forgetOverride,
  readOverrides,
  OVERRIDES_FILENAME,
} from '../../src/lib/sync/overrides.js';
import { readLog } from '../../src/lib/sync/log.js';
import { syncLogPath } from '../../src/lib/sync/config.js';
import { makeTmpDir, publishBundle, writeSeedSchema, UMBRELLA_SCHEMA } from '../sync/fixture.js';

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

const V1 = { ...UMBRELLA_SCHEMA, tokens: { color: { primary: '#0070f3', accent: '#6366f1' }, type: {} } };
const V2 = { ...V1, tokens: { color: { primary: '#1e40af', accent: '#6366f1' }, type: {} } };

describe('0.3.0 E2E rig — umbrella + 3 sub-sites (AC #38)', () => {
  it('umbrella distributes V2; site-A adopts, site-B holds override, site-C forgets and adopts', async () => {
    const umbrella = makeTmpDir('vbrand-umbrella-');
    dirs.push(umbrella);
    const distDir = join(umbrella, 'dist');
    const kp = generateKeyPair();

    const umbrellaUrl = publishBundle(distDir, V1, kp);

    const makeSubSite = () => {
      const d = makeTmpDir('vbrand-e2e-');
      dirs.push(d);
      writeSeedSchema(d, V1);
      return d;
    };

    const siteA = makeSubSite();
    const siteB = makeSubSite();
    const siteC = makeSubSite();

    await runSyncInit({ cwd: siteA, umbrellaUrl });
    await runSyncInit({ cwd: siteB, umbrellaUrl });
    await runSyncInit({ cwd: siteC, umbrellaUrl });

    await runSyncPull({ cwd: siteA });
    await runSyncPull({ cwd: siteB });
    await runSyncPull({ cwd: siteC });

    const v1Digest = digestJson(V1);
    const overrideB = setOverride(createOverridesDoc(umbrellaUrl, v1Digest), 'tokens.color.primary', '#0070f3', 'B keeps legacy blue');
    writeOverrides(join(siteB, OVERRIDES_FILENAME), overrideB);

    const overrideC = setOverride(createOverridesDoc(umbrellaUrl, v1Digest), 'tokens.color.primary', '#0070f3', 'C temporarily keeps legacy');
    writeOverrides(join(siteC, OVERRIDES_FILENAME), overrideC);

    publishBundle(distDir, V2, kp);

    const resultA = await runSyncPull({ cwd: siteA });
    const resultB = await runSyncPull({ cwd: siteB });

    const readSchema = <T>(site: string): T => JSON.parse(readFileSync(join(site, 'vbrand.schema.json'), 'utf-8')) as T;

    expect(readSchema<{ tokens: { color: { primary: string } } }>(siteA).tokens.color.primary).toBe('#1e40af');
    expect(resultA.fieldsHeld).toHaveLength(0);

    expect(readSchema<{ tokens: { color: { primary: string } } }>(siteB).tokens.color.primary).toBe('#0070f3');
    expect(resultB.fieldsHeld).toContain('tokens.color.primary');
    expect(resultB.observedValues['tokens.color.primary']).toBe('#1e40af');

    const statusB = await computeSyncStatus({ cwd: siteB });
    expect(statusB.code).toBe(2);
    expect(statusB.ahead).toBe(true);

    const forgottenDoc = forgetOverride(readOverrides(join(siteC, OVERRIDES_FILENAME))!, 'tokens.color.primary');
    writeOverrides(join(siteC, OVERRIDES_FILENAME), forgottenDoc);

    const resultC = await runSyncPull({ cwd: siteC });
    expect(readSchema<{ tokens: { color: { primary: string } } }>(siteC).tokens.color.primary).toBe('#1e40af');
    expect(resultC.fieldsHeld).toHaveLength(0);

    const v2Digest = digestJson(V2);
    expect(resultA.digest).toBe(v2Digest);
    expect(resultB.digest).toBe(v2Digest);
    expect(resultC.digest).toBe(v2Digest);

    for (const site of [siteA, siteB, siteC]) {
      expect(readLog(syncLogPath(site)).filter((e) => e.op === 'pull').length).toBeGreaterThanOrEqual(1);
    }

    const latestHeldPullB = [...readLog(syncLogPath(siteB))].reverse().find((e) => e.op === 'pull' && Boolean(e.fieldsHeld));
    expect(latestHeldPullB?.observedValues?.['tokens.color.primary']).toBe('#1e40af');

    const overridesB = readOverrides(join(siteB, OVERRIDES_FILENAME));
    expect(overridesB?.overrides['tokens.color.primary']?.value).toBe('#0070f3');
    expect(overridesB?.overrides['tokens.color.primary']?.superseded).toBeUndefined();

    const overridesC = readOverrides(join(siteC, OVERRIDES_FILENAME));
    expect(overridesC?.overrides['tokens.color.primary']?.superseded).toBe(true);
  });
});
