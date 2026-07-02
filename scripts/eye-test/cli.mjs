// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko

function argValue(args, flag) {
  const i = args.indexOf(flag);
  return i !== -1 && i + 1 < args.length ? args[i + 1] : null;
}

export function parseArgs(argv) {
  const args = argv.slice(2);
  return {
    exhaustive:  args.includes('--exhaustive'),
    baseUrl:     process.env['EYE_TEST_BASE_URL'] ?? argValue(args, '--url') ?? 'https://bvasilenko.github.io',
    outputDir:   argValue(args, '--output-dir') ?? 'dist',
    concurrency: parseInt(argValue(args, '--concurrency') ?? '4', 10),
  };
}
