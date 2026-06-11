// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const root = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const cli = path.join(root, 'node_modules/tailwindcss/lib/cli.js');
const config = path.join(root, 'scripts/tailwind-ssr.config.cjs');
const input = path.join(root, 'src/ssr/tailwind-entry.css');
const output = path.join(root, 'src/ssr/tailwind.css');
const bundleTs = path.join(root, 'src/ssr/tailwind-bundle.ts');

execSync(
  `node "${cli}" -i "${input}" -o "${output}" --config "${config}" --minify`,
  { cwd: root, stdio: 'inherit' },
);

const css = fs.readFileSync(output, 'utf-8');
const tsContent = [
  '// SPDX-License-Identifier: MIT',
  '// Copyright (c) 2026 bvasilenko',
  `export const TAILWIND_BUNDLE: string = ${JSON.stringify(css)};`,
  '',
].join('\n');
fs.writeFileSync(bundleTs, tsContent, 'utf-8');
