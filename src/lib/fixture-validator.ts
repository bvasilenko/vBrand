// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ZodError } from 'zod';
import { VbrandSchema, VbrandType } from '../schema.js';

export interface FixtureError {
  file: string;
  error: string;
}

export interface FixtureValidationReport {
  valid: string[];
  invalid: FixtureError[];
}

export function validateFixtureFile(fixturePath: string): VbrandType {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(fixturePath, 'utf-8'));
  } catch {
    throw new Error(`Cannot read or parse fixture: ${fixturePath}`);
  }
  return VbrandSchema.parse(raw);
}

export function validateFixtureDir(
  dir: string,
  pattern: RegExp = /\.json$/,
): FixtureValidationReport {
  const files = readdirSync(dir).filter((f) => pattern.test(f));
  const valid: string[] = [];
  const invalid: FixtureError[] = [];

  for (const file of files) {
    const fullPath = join(dir, file);
    try {
      validateFixtureFile(fullPath);
      valid.push(file);
    } catch (err) {
      const message =
        err instanceof ZodError
          ? err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')
          : String(err);
      invalid.push({ file, error: message });
    }
  }

  return { valid, invalid };
}
