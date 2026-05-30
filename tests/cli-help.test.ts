// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it, beforeAll } from 'vitest';

const ROOT = join(import.meta.dirname, '..');

const EXPECTED_COMMANDS = ['pull', 'fuse', 'emit', 'audit', 'publish', 'sync', 'init-ci', 'deploy'] as const;
const REMOVED_COMMANDS = ['init', 'classify'] as const;

function captureHelp(): string {
  return execFileSync('bun', ['src/cli.ts', '--help'], {
    encoding: 'utf-8',
    cwd: ROOT,
  });
}

describe('vbrand --help', () => {
  let output: string;

  beforeAll(() => {
    output = captureHelp();
  });

  it.each(EXPECTED_COMMANDS)('lists the %s command', (cmd) => {
    expect(output).toContain(cmd);
  });

  it.each(REMOVED_COMMANDS)(
    'does not list removed 0.1.x command %s as a command entry',
    (cmd) => {
      // Match as a command listing line: two leading spaces then the command name
      // followed by whitespace or end-of-line. Avoids false positives from
      // description text that happens to contain the same substring.
      expect(output).not.toMatch(new RegExp(`^  ${cmd}[\\s\\n]`, 'm'));
    },
  );

  it('shows exactly 8 user-facing commands in the command list', () => {
    // Commander indents command entries with 2 spaces; filter out the built-in
    // "help" command which is not a user-facing command. 0.3.0 adds sync, init-ci, deploy.
    const commandLines = output
      .split('\n')
      .filter((line) => /^  [a-z]/.test(line) && !line.trim().startsWith('help'));
    expect(commandLines).toHaveLength(8);
  });

  it('usage line names the binary vbrand', () => {
    expect(output).toMatch(/^Usage: vbrand/m);
  });
});
