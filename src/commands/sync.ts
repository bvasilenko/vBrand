// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { join } from 'node:path';
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { runSyncInit, runSyncPull } from '../lib/sync/pull.js';
import { runSyncPush } from '../lib/sync/push.js';
import { computeSyncStatus, runSyncVerify } from '../lib/sync/status.js';
import { generateKeyPair } from '../lib/sync/sign.js';
import {
  readSyncConfig,
  writeSyncConfig,
  defaultConflictPolicy,
  syncLogPath,
} from '../lib/sync/config.js';
import {
  readOverrides,
  writeOverrides,
  createOverridesDoc,
  setOverride,
  forgetOverride,
  OVERRIDES_FILENAME,
} from '../lib/sync/overrides.js';
import { readLog, readLogSince } from '../lib/sync/log.js';
import type { ConflictPolicy } from '../lib/sync/types.js';

const STATUS_LABELS: Record<number, string> = {
  0: 'clean',
  1: 'behind',
  2: 'ahead',
  3: 'diverged',
};

export function buildSyncCommand(): Command {
  const sync = new Command('sync').description(
    'multi-brand single-directional sync — umbrella → sub-sites',
  );

  sync
    .command('init <umbrella-url>')
    .description(
      'bootstrap sync trust: fetch umbrella public key, write .vbrand/sync.config.json',
    )
    .option(
      '--policy <policy>',
      'conflict policy: respect | force | warn',
      'respect',
    )
    .option('--as-umbrella', 'initialise this project as the distribution umbrella')
    .option('--out-dir <dir>', 'distribution output dir (umbrella mode only)')
    .action(
      async (
        umbrellaUrl: string,
        cmd: { policy: string; asUmbrella?: boolean; outDir?: string },
      ) => {
        const cwd = process.cwd();

        if (cmd.asUmbrella) {
          const spinner = ora('Generating ed25519 keypair…').start();
          try {
            const kp = generateKeyPair();
            writeSyncConfig(cwd, {
              umbrellaUrl,
              publicKeyBase64: kp.publicKeyBase64,
              conflictPolicy: (cmd.policy as ConflictPolicy) ?? defaultConflictPolicy(),
              ...(cmd.outDir !== undefined ? { distributionDir: cmd.outDir } : {}),
            });
            spinner.succeed(chalk.green('Umbrella initialised.'));
            console.log(
              chalk.yellow('\n  Store the private key securely — it will not be shown again:\n'),
            );
            console.log(
              `  VBRAND_SYNC_PRIVATE_KEY=${kp.privateKeyBase64}\n`,
            );
          } catch (err) {
            spinner.fail(chalk.red(err instanceof Error ? err.message : String(err)));
            process.exit(1);
          }
          return;
        }

        const spinner = ora('Fetching umbrella public key…').start();
        try {
          await runSyncInit({
            cwd,
            umbrellaUrl,
            conflictPolicy: (cmd.policy as ConflictPolicy) ?? defaultConflictPolicy(),
          });
          spinner.succeed(chalk.green(`Sync initialised. Config → .vbrand/sync.config.json`));
        } catch (err) {
          spinner.fail(chalk.red(err instanceof Error ? err.message : String(err)));
          process.exit(1);
        }
      },
    );

  sync
    .command('pull')
    .description('fetch umbrella head, verify, merge, re-apply overrides')
    .option('--policy <policy>', 'override conflict policy for this pull only')
    .action(async (cmd: { policy?: string }) => {
      const spinner = ora('Pulling from umbrella…').start();
      try {
        const result = await runSyncPull({
          forcePolicy: cmd.policy as ConflictPolicy | undefined,
        });
        if (result.alreadyCurrent) {
          spinner.succeed(chalk.green('Already up to date.'));
        } else {
          spinner.succeed(chalk.green(`Synced to ${result.digest.slice(0, 12)}…`));
          const heldSummary =
            result.fieldsHeld.length > 0
              ? `${result.fieldsHeld.length} field(s) held by override: ${result.fieldsHeld.join(', ')}`
              : '0 fields held by override';
          console.log(
            chalk.cyan(
              `  ${result.fieldsAdopted} field(s) adopted, ${heldSummary}`,
            ),
          );
        }
      } catch (err) {
        spinner.fail(chalk.red(err instanceof Error ? err.message : String(err)));
        process.exit(1);
      }
    });

  sync
    .command('push')
    .description(
      'scrub handles, audit, sign, and write distribution files (umbrella only)',
    )
    .option('--out-dir <dir>', 'override distribution output directory')
    .option('--note <note>', 'release note for this push')
    .action(async (cmd: { outDir?: string; note?: string }) => {
      const privateKey = process.env['VBRAND_SYNC_PRIVATE_KEY'];
      if (!privateKey) {
        console.error(
          chalk.red('VBRAND_SYNC_PRIVATE_KEY env var is required for sync push.'),
        );
        process.exit(1);
      }
      const spinner = ora('Preparing distribution bundle…').start();
      try {
        const result = await runSyncPush({
          outDir: cmd.outDir,
          releaseNote: cmd.note,
          privateKeyBase64: privateKey,
        });
        spinner.succeed(chalk.green(`Pushed → ${result.digest.slice(0, 12)}…`));
        for (const f of result.files) console.log(chalk.dim('  ' + f));
      } catch (err) {
        spinner.fail(chalk.red(err instanceof Error ? err.message : String(err)));
        process.exit(1);
      }
    });

  sync
    .command('status')
    .description(
      'show divergence vs umbrella head (exit 0=clean, 1=behind, 2=ahead, 3=diverged)',
    )
    .action(async () => {
      try {
        const status = await computeSyncStatus();
        const label = STATUS_LABELS[status.code] ?? 'unknown';
        const colour =
          status.code === 0
            ? chalk.green
            : status.code === 2
              ? chalk.yellow
              : chalk.red;
        console.log(colour(`sync status: ${label}`));
        if (status.heldFields.length > 0) {
          console.log(chalk.dim(`  held fields: ${status.heldFields.join(', ')}`));
        }
        process.exit(status.code);
      } catch (err) {
        console.error(chalk.red(err instanceof Error ? err.message : String(err)));
        process.exit(1);
      }
    });

  sync
    .command('verify')
    .description('verify signature and handle-audit the current umbrella head')
    .action(async () => {
      const spinner = ora('Verifying umbrella head…').start();
      try {
        const result = await runSyncVerify();
        if (result.valid) {
          spinner.succeed(chalk.green(`Valid. Digest: ${result.digest.slice(0, 12)}…`));
        } else {
          spinner.fail(chalk.red('Verification failed.'));
          if (!result.signatureOk) {
            console.error(chalk.red('  Signature invalid.'));
          }
          if (result.handleLeakFindings.length > 0) {
            for (const f of result.handleLeakFindings) {
              console.error(chalk.red(`  E_HANDLE_LEAK_DOWNSTREAM at ${f.jsonPointer}`));
            }
          }
          process.exit(1);
        }
      } catch (err) {
        spinner.fail(chalk.red(err instanceof Error ? err.message : String(err)));
        process.exit(1);
      }
    });

  sync
    .command('override <field>')
    .description('declare a local override for a schema field (dot-path)')
    .option('--value <json>', 'JSON-encoded value for the override')
    .option('--reason <text>', 'human-readable reason')
    .action(async (field: string, cmd: { value?: string; reason?: string }) => {
      const cwd = process.cwd();
      const overridesPath = join(cwd, OVERRIDES_FILENAME);
      try {
        const config = readSyncConfig(cwd);
        const current = readOverrides(overridesPath) ??
          createOverridesDoc(config.umbrellaUrl, config.lastDigest ?? '');

        const value = cmd.value !== undefined ? JSON.parse(cmd.value) : undefined;
        if (value === undefined) {
          throw new Error('--value <json> is required.');
        }
        const actor = process.env['VBRAND_ACTOR'] ?? process.env['GIT_AUTHOR_EMAIL'];
        const updated = setOverride(current, field, value, cmd.reason, actor);
        writeOverrides(overridesPath, updated);
        console.log(chalk.green(`Override set for: ${field}`));
      } catch (err) {
        console.error(chalk.red(err instanceof Error ? err.message : String(err)));
        process.exit(1);
      }
    });

  sync
    .command('forget <field>')
    .description('remove a local override and resume tracking umbrella for that field')
    .action(async (field: string) => {
      const cwd = process.cwd();
      const overridesPath = join(cwd, OVERRIDES_FILENAME);
      try {
        const current = readOverrides(overridesPath);
        if (!current) {
          console.log(chalk.dim('No overrides file found.'));
          return;
        }
        const updated = forgetOverride(current, field);
        writeOverrides(overridesPath, updated);
        console.log(chalk.green(`Override removed for: ${field}`));
      } catch (err) {
        console.error(chalk.red(err instanceof Error ? err.message : String(err)));
        process.exit(1);
      }
    });

  sync
    .command('log')
    .description('show sync history from .vbrand/sync.log.jsonl')
    .option('--since <digest>', 'show entries after the given digest')
    .option('-n <count>', 'show the last N entries', '20')
    .action((cmd: { since?: string; n: string }) => {
      const cwd = process.cwd();
      const logPath = syncLogPath(cwd);
      try {
        const entries = cmd.since
          ? readLogSince(logPath, cmd.since)
          : readLog(logPath).slice(-Number(cmd.n));

        if (entries.length === 0) {
          console.log(chalk.dim('No sync log entries.'));
          return;
        }
        for (const e of entries) {
          const held = e.fieldsHeld?.length ? ` held:${e.fieldsHeld.join(',')}` : '';
          console.log(
            `${chalk.dim(e.at)} ${chalk.bold(e.op)} ${e.digest.slice(0, 12)}${held}`,
          );
        }
      } catch (err) {
        console.error(chalk.red(err instanceof Error ? err.message : String(err)));
        process.exit(1);
      }
    });

  return sync;
}
