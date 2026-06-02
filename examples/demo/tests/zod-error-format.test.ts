// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { describe, it, expect } from 'vitest';
import { formatZodError } from '../src/zod-error-format.js';

const SINGLE_ISSUE_MESSAGE = `ZodError: [{"code":"invalid_type","expected":"string","received":"undefined","path":["name"],"message":"Required"}]`;

const MULTI_ISSUE_MESSAGE = `ZodError: [{"code":"invalid_type","expected":"string","received":"undefined","path":["name"],"message":"Required"},{"code":"invalid_type","expected":"string","received":"undefined","path":["voice","canonical"],"message":"Required"}]`;

const ROOT_ISSUE_MESSAGE = `ZodError: [{"code":"invalid_type","expected":"object","received":"null","path":[],"message":"Expected object, received null"}]`;

const ARRAY_PATH_MESSAGE = `ZodError: [{"code":"invalid_type","expected":"string","received":"undefined","path":["items",0,"name"],"message":"Required"}]`;

const NON_ZOD_STRINGS = [
  ['plain text error',             'Failed to fetch'],
  ['empty string',                 ''],
  ['message without JSON array',   'Error: something went wrong'],
  ['message with JSON object',     'Error: {"code":"x"}'],
  ['CORS network error',           'CORS policy blocked fetch'],
  ['HTTP status error',            'HTTP 404'],
] as const;

describe('formatZodError: returns null for non-Zod error messages', () => {
  it.each(NON_ZOD_STRINGS)('%s → null', (_, message) => {
    expect(formatZodError(message)).toBeNull();
  });
});

describe('formatZodError: parses single-issue Zod messages', () => {
  it('returns a FormattedZodError (not null)', () => {
    expect(formatZodError(SINGLE_ISSUE_MESSAGE)).not.toBeNull();
  });

  it('summary mentions 1 issue', () => {
    const result = formatZodError(SINGLE_ISSUE_MESSAGE)!;
    expect(result.summary).toBe('JSON payload validation failed: 1 issue');
  });

  it('fields contains one entry with path "name"', () => {
    const result = formatZodError(SINGLE_ISSUE_MESSAGE)!;
    expect(result.fields).toHaveLength(1);
    expect(result.fields[0].path).toBe('name');
    expect(result.fields[0].message).toBe('Required');
  });
});

describe('formatZodError: parses multi-issue Zod messages', () => {
  it('summary mentions the correct issue count', () => {
    const result = formatZodError(MULTI_ISSUE_MESSAGE)!;
    expect(result.summary).toBe('JSON payload validation failed: 2 issues');
  });

  it('fields has an entry for each issue with correct dot-separated path', () => {
    const result = formatZodError(MULTI_ISSUE_MESSAGE)!;
    expect(result.fields[0].path).toBe('name');
    expect(result.fields[1].path).toBe('voice.canonical');
  });
});

describe('formatZodError: handles root-level issues (empty path)', () => {
  it('uses "(root)" for issues with an empty path array', () => {
    const result = formatZodError(ROOT_ISSUE_MESSAGE)!;
    expect(result.fields[0].path).toBe('(root)');
  });
});

describe('formatZodError: handles array-index path segments', () => {
  it('numeric segments in path are joined with dots: items.0.name', () => {
    const result = formatZodError(ARRAY_PATH_MESSAGE)!;
    expect(result.fields[0].path).toBe('items.0.name');
  });
});
