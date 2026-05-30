// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { beforeAll, describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..');
const DIST_DIR = join(ROOT, 'dist');

const FORBIDDEN_SDK_PATTERNS = [
  'openai',
  '@anthropic-ai',
  '@google/generative-ai',
  '@google-ai/generativelanguage',
  'langchain',
  'groq-sdk',
  'cohere-ai',
  '@mistralai',
] as const;

function ensureDist(): void {
  try {
    statSync(DIST_DIR);
  } catch {
    const result = spawnSync('bun', ['run', 'build'], { cwd: ROOT, encoding: 'utf-8' });
    if (result.status !== 0) throw new Error(`Build failed: ${result.stderr}`);
  }
}

function distFiles(): string[] {
  const results: string[] = [];
  function walk(dir: string): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith('.js') || entry.name.endsWith('.cjs')) {
        results.push(full);
      }
    }
  }
  walk(DIST_DIR);
  return results;
}

describe('no-llm-in-cli — dist/ must contain no AI SDK imports', () => {
  beforeAll(() => ensureDist());

  it.each(FORBIDDEN_SDK_PATTERNS)(
    'dist/ does not contain forbidden SDK pattern: %s',
    (pattern) => {
      const files = distFiles();
      const matching: string[] = [];
      for (const file of files) {
        const content = readFileSync(file, 'utf-8');
        if (content.includes(pattern)) {
          matching.push(file);
        }
      }
      expect(
        matching,
        `Found "${pattern}" in dist files: ${matching.join(', ')}`,
      ).toHaveLength(0);
    },
  );
});
