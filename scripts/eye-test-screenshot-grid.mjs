// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { parseArgs } from './eye-test/cli.mjs';
import { run } from './eye-test/pipeline.mjs';

run(parseArgs(process.argv)).catch((err) => {
  console.error(err);
  process.exit(1);
});
