// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';

type ParseArgs = (argv: string[]) => {
  exhaustive: boolean;
  baseUrl: string;
  outputDir: string;
  concurrency: number;
};

let parseArgs: ParseArgs;

beforeAll(async () => {
  const mod = await vi.importActual<{ parseArgs: ParseArgs }>('../../../scripts/eye-test/cli.mjs');
  ({ parseArgs } = mod);
});

const BASE_ARGV = ['node', 'eye-test.mjs'];
const ENV_KEY = 'EYE_TEST_BASE_URL';

afterEach(() => {
  delete process.env[ENV_KEY];
});

describe('parseArgs - default values', () => {
  it('exhaustive defaults to false', () => {
    expect(parseArgs(BASE_ARGV).exhaustive).toBe(false);
  });

  it('outputDir defaults to "dist"', () => {
    expect(parseArgs(BASE_ARGV).outputDir).toBe('dist');
  });

  it('concurrency defaults to 4', () => {
    expect(parseArgs(BASE_ARGV).concurrency).toBe(4);
  });

  it('baseUrl defaults to the canonical production GitHub Pages URL', () => {
    expect(parseArgs(BASE_ARGV).baseUrl).toBe('https://bvasilenko.github.io');
  });

  it('all four fields are present in the result with no flags', () => {
    const result = parseArgs(BASE_ARGV);
    expect('exhaustive' in result).toBe(true);
    expect('baseUrl' in result).toBe(true);
    expect('outputDir' in result).toBe(true);
    expect('concurrency' in result).toBe(true);
  });
});

describe('parseArgs - --exhaustive flag', () => {
  it('--exhaustive sets exhaustive to true', () => {
    expect(parseArgs([...BASE_ARGV, '--exhaustive']).exhaustive).toBe(true);
  });

  it('absence of --exhaustive keeps exhaustive false even with other flags present', () => {
    expect(parseArgs([...BASE_ARGV, '--url', 'http://localhost:4000']).exhaustive).toBe(false);
  });

  it('--exhaustive at the end of argv (after other flags) is recognised', () => {
    expect(parseArgs([...BASE_ARGV, '--url', 'http://x.com', '--exhaustive']).exhaustive).toBe(true);
  });

  it('--exhaustive before --url is recognised', () => {
    expect(parseArgs([...BASE_ARGV, '--exhaustive', '--url', 'http://x.com']).exhaustive).toBe(true);
  });
});

describe('parseArgs - --url flag', () => {
  it('--url sets baseUrl to the provided value', () => {
    expect(parseArgs([...BASE_ARGV, '--url', 'http://localhost:5000']).baseUrl).toBe('http://localhost:5000');
  });

  it('--url with a trailing-slash URL preserves the value verbatim', () => {
    expect(parseArgs([...BASE_ARGV, '--url', 'https://example.com/']).baseUrl).toBe('https://example.com/');
  });

  it('--url without a following value falls back to the default base URL', () => {
    expect(parseArgs([...BASE_ARGV, '--url']).baseUrl).toBe('https://bvasilenko.github.io');
  });
});

describe('parseArgs - --output-dir flag', () => {
  it('--output-dir sets outputDir to the provided value', () => {
    expect(parseArgs([...BASE_ARGV, '--output-dir', 'custom-out']).outputDir).toBe('custom-out');
  });

  it('--output-dir accepts paths with slashes', () => {
    expect(parseArgs([...BASE_ARGV, '--output-dir', 'dist/eye-test']).outputDir).toBe('dist/eye-test');
  });

  it('--output-dir without a following value falls back to the default outputDir', () => {
    expect(parseArgs([...BASE_ARGV, '--output-dir']).outputDir).toBe('dist');
  });
});

describe('parseArgs - --concurrency flag', () => {
  it('--concurrency parses the value as an integer', () => {
    expect(parseArgs([...BASE_ARGV, '--concurrency', '8']).concurrency).toBe(8);
  });

  it('--concurrency result is always of type number', () => {
    expect(typeof parseArgs([...BASE_ARGV, '--concurrency', '2']).concurrency).toBe('number');
  });

  it('default concurrency is of type number', () => {
    expect(typeof parseArgs(BASE_ARGV).concurrency).toBe('number');
  });

  it('--concurrency without a following value falls back to default', () => {
    expect(parseArgs([...BASE_ARGV, '--concurrency']).concurrency).toBe(4);
  });
});

describe('parseArgs - EYE_TEST_BASE_URL environment variable', () => {
  it('EYE_TEST_BASE_URL overrides the default base URL when no --url flag is present', () => {
    process.env[ENV_KEY] = 'https://env-host.com';
    expect(parseArgs(BASE_ARGV).baseUrl).toBe('https://env-host.com');
  });

  it('EYE_TEST_BASE_URL takes precedence over the --url flag', () => {
    process.env[ENV_KEY] = 'https://env-host.com';
    expect(parseArgs([...BASE_ARGV, '--url', 'https://flag-host.com']).baseUrl).toBe('https://env-host.com');
  });

  it('baseUrl falls back to --url when EYE_TEST_BASE_URL is absent', () => {
    expect(parseArgs([...BASE_ARGV, '--url', 'https://flag-host.com']).baseUrl).toBe('https://flag-host.com');
  });

  it('baseUrl falls back to the production default when neither env var nor --url is set', () => {
    expect(parseArgs(BASE_ARGV).baseUrl).toBe('https://bvasilenko.github.io');
  });
});

describe('parseArgs - argv slice behaviour', () => {
  it('argv[0] and argv[1] (runtime and script path) are not interpreted as flags', () => {
    const result = parseArgs(['ignored-runtime', 'ignored-script', '--url', 'https://x.com']);
    expect(result.baseUrl).toBe('https://x.com');
  });

  it('empty user-facing argv (beyond runtime and script path) applies all defaults', () => {
    const result = parseArgs(['node', 'eye-test.mjs']);
    expect(result.exhaustive).toBe(false);
    expect(result.outputDir).toBe('dist');
    expect(result.concurrency).toBe(4);
  });

  it('all four flags together produce the correct combined result', () => {
    const result = parseArgs([
      ...BASE_ARGV,
      '--exhaustive',
      '--url', 'http://localhost:9000',
      '--output-dir', 'out',
      '--concurrency', '16',
    ]);
    expect(result.exhaustive).toBe(true);
    expect(result.baseUrl).toBe('http://localhost:9000');
    expect(result.outputDir).toBe('out');
    expect(result.concurrency).toBe(16);
  });
});
