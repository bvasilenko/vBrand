// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';
import { runPull } from './commands/pull.js';
import { runFuse } from './commands/fuse.js';
import { runEmit, EmitTarget } from './commands/emit.js';
import { runAudit } from './commands/audit.js';
import { runPublish, PublishAs } from './commands/publish.js';
import { buildSyncCommand } from './commands/sync.js';
import { buildInitCiCommand } from './commands/init-ci.js';
import { buildDeployCommand } from './commands/deploy.js';

const program = new Command();

program
  .name('vbrand')
  .description('Active brand-operations layer. pull, fuse, emit, audit, publish, sync, init-ci, deploy.')
  .version('0.3.0');

program
  .command('pull <source>')
  .description(
    'resolve brand signals from ./file.json | https://… | gh:<handle> | npm:<pkg> → vbrand.schema.json',
  )
  .action(async (source: string) => {
    const spinner = ora('Pulling brand signals…').start();
    try {
      const result = await runPull(source);
      spinner.succeed(chalk.green(`Candidate written → ${result.candidatePath}`));
    } catch (err) {
      spinner.fail(chalk.red(err instanceof Error ? err.message : String(err)));
      process.exit(1);
    }
  });

program
  .command('fuse <a> [b] [rest...]')
  .description('merge N schemas into one canonical vbrand.schema.json')
  .option(
    '--strategy <strategy>',
    'umbrella-wins | merge-patch | cascade',
    'umbrella-wins',
  )
  .option('--inject-baseline', 'inject internal brand-neutral baseline at lowest precedence')
  .action(async (
    a: string,
    b: string | undefined,
    rest: string[],
    cmd: { strategy: string; injectBaseline?: boolean },
  ) => {
    const inputs = b !== undefined ? [a, b, ...rest] : [a];
    const spinner = ora('Fusing schemas…').start();
    try {
      const result = await runFuse(inputs, {
        strategy: cmd.strategy as 'umbrella-wins' | 'merge-patch' | 'cascade',
        injectBaseline: cmd.injectBaseline,
      });
      spinner.succeed(chalk.green(`Fused → ${result.schemaPath} (${result.strategy})`));
      if (result.scrubFindings.length > 0) {
        console.log(chalk.yellow(`\n${result.scrubFindings.length} scrub finding(s):`));
        console.log(JSON.stringify(result.scrubFindings, null, 2));
      }
    } catch (err) {
      spinner.fail(chalk.red(err instanceof Error ? err.message : String(err)));
      process.exit(1);
    }
  });

program
  .command('emit')
  .description(
    'read vbrand.schema.json, emit public/brand/ (favicons, og, manifest, css-vars, DESIGN.md)',
  )
  .option(
    '--target <target>',
    'public/brand | voice-samples | readme | og-copy',
    'public/brand',
  )
  .action(async (cmd: { target: string }) => {
    const spinner = ora('Emitting brand assets…').start();
    try {
      const result = await runEmit({ target: cmd.target as EmitTarget });
      spinner.succeed(chalk.green(`Emitted → ${result.outDir}`));
      for (const f of result.files) {
        console.log(chalk.dim('  ' + f));
      }
    } catch (err) {
      spinner.fail(chalk.red(err instanceof Error ? err.message : String(err)));
      process.exit(1);
    }
  });

program
  .command('audit')
  .description('audit brand surface for drift, a11y, and slot completeness')
  .option('--strict', 'exit 1 on any finding')
  .option('--against <source>', 'compare schema against external surface')
  .action(async (cmd: { strict?: boolean; against?: string }) => {
    const spinner = ora('Auditing brand surface…').start();
    try {
      const result = await runAudit({ strict: cmd.strict, against: cmd.against });
      if (result.clean) {
        spinner.succeed(chalk.green('Brand surface is clean'));
        if (result.reportPath) console.log(chalk.dim(`  Report: ${result.reportPath}`));
        process.exit(0);
      } else {
        spinner.fail(chalk.red('Audit findings detected'));
        for (const d of result.drifted) console.error(chalk.yellow(`  drift: ${d}`));
        for (const f of result.axeFindings) console.error(chalk.yellow(`  a11y: ${f.ruleId}`));
        for (const s of result.slotFindings) console.error(chalk.yellow(`  slot: ${s.slotName}`));
        if (result.reportPath) console.log(chalk.dim(`  Report: ${result.reportPath}`));
        if (cmd.strict) process.exit(1);
        process.exit(0);
      }
    } catch (err) {
      spinner.fail(chalk.red(err instanceof Error ? err.message : String(err)));
      process.exit(1);
    }
  });

program
  .command('publish')
  .description('write a portable brand bundle to dist/')
  .option('--as <format>', 'registry-item | dtcg | npm', 'registry-item')
  .option('--experimental', 'enable experimental output formats')
  .action(async (cmd: { as: string; experimental?: boolean }) => {
    const spinner = ora('Publishing brand bundle…').start();
    try {
      const result = await runPublish({
        as: cmd.as as PublishAs,
        experimental: cmd.experimental,
      });
      if (result.notice) {
        console.log(chalk.yellow(`\nNotice: ${result.notice}`));
      }
      spinner.succeed(chalk.green(`Published (${result.format})`));
      for (const f of result.files) console.log(chalk.dim('  ' + f));
    } catch (err) {
      spinner.fail(chalk.red(err instanceof Error ? err.message : String(err)));
      process.exit(1);
    }
  });

program.addCommand(buildSyncCommand());
program.addCommand(buildInitCiCommand());
program.addCommand(buildDeployCommand());

program.parse();
