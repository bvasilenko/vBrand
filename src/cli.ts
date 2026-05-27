import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';
import { runAudit } from './commands/audit.js';
import { runClassify } from './commands/classify.js';
import { runEmit } from './commands/emit.js';
import { runInit } from './commands/init.js';

const program = new Command();

program
  .name('vbrand')
  .description('Brand-OS CLI - scaffold, emit, classify, audit.')
  .version('0.1.0');

program
  .command('init [name]')
  .description('scaffold a vUi-ready Vite+React project + brand-os.schema.json')
  .action(async (name?: string) => {
    const spinner = ora('Scaffolding project…').start();
    try {
      const result = runInit({ name });
      spinner.succeed(chalk.green(`Created ${result.projectDir}`));
      console.log(chalk.dim(`  ${result.files.length} files written`));
      console.log(chalk.dim('  Run: cd ' + result.projectDir + ' && bun install'));
    } catch (err) {
      spinner.fail(chalk.red(err instanceof Error ? err.message : String(err)));
      process.exit(1);
    }
  });

program
  .command('emit')
  .description('read brand-os.schema.json, emit public/brand/')
  .action(async () => {
    const spinner = ora('Emitting brand assets…').start();
    try {
      const result = await runEmit();
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
  .command('classify <html-file>')
  .description('parse HTML, classify nodes, output JSON')
  .action(async (htmlFile: string) => {
    try {
      const report = runClassify({ htmlPath: htmlFile });
      console.log(JSON.stringify(report, null, 2));
    } catch (err) {
      console.error(chalk.red(err instanceof Error ? err.message : String(err)));
      process.exit(1);
    }
  });

program
  .command('audit')
  .description('check brand surface vs schema; exit 1 on drift')
  .action(async () => {
    const spinner = ora('Auditing brand surface…').start();
    try {
      const result = await runAudit();
      if (result.clean) {
        spinner.succeed(chalk.green('Brand surface is clean'));
        process.exit(0);
      } else {
        spinner.fail(chalk.red('Drift detected'));
        for (const path of result.drifted) {
          console.error(chalk.yellow('  drift: ' + path));
        }
        process.exit(1);
      }
    } catch (err) {
      spinner.fail(chalk.red(err instanceof Error ? err.message : String(err)));
      process.exit(1);
    }
  });

program.parse();
