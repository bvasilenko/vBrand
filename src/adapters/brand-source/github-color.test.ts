// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { describe, it, expect } from 'vitest';
import { deriveGithubBrandColor } from './github-color.js';
import { GITHUB_LANGUAGE_COLORS } from './github-language-colors.js';

describe('deriveGithubBrandColor - absent / empty inputs', () => {
  it('returns undefined for null', () => {
    expect(deriveGithubBrandColor(null)).toBeUndefined();
  });

  it('returns undefined for undefined', () => {
    expect(deriveGithubBrandColor(undefined)).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(deriveGithubBrandColor('')).toBeUndefined();
  });
});

describe('deriveGithubBrandColor - unrecognised inputs', () => {
  it('returns undefined for an unrecognised language', () => {
    expect(deriveGithubBrandColor('COBOL')).toBeUndefined();
  });

  it('is case-sensitive: a lowercase variant of a known language returns undefined', () => {
    expect(deriveGithubBrandColor('typescript')).toBeUndefined();
  });

  it('is case-sensitive: a mixed-case variant of a known language returns undefined', () => {
    expect(deriveGithubBrandColor('Javascript')).toBeUndefined();
  });
});

describe('deriveGithubBrandColor - spot-check known languages', () => {
  it.each([
    ['TypeScript', '#3178c6'],
    ['JavaScript', '#f1e05a'],
    ['Python',     '#3572A5'],
    ['Rust',       '#dea584'],
    ['Go',         '#00ADD8'],
    ['Java',       '#b07219'],
    ['Ruby',       '#701516'],
  ] as const)(
    '%s returns exactly %s',
    (lang, expected) => {
      expect(deriveGithubBrandColor(lang)).toBe(expected);
    },
  );
});

describe('deriveGithubBrandColor - exhaustive static map coverage', () => {
  it('returns a defined color for every language present in GITHUB_LANGUAGE_COLORS', () => {
    for (const lang of Object.keys(GITHUB_LANGUAGE_COLORS)) {
      expect(deriveGithubBrandColor(lang)).toBeDefined();
    }
  });

  it('every color returned for a known language is a non-empty string starting with #', () => {
    for (const lang of Object.keys(GITHUB_LANGUAGE_COLORS)) {
      const color = deriveGithubBrandColor(lang);
      expect(typeof color).toBe('string');
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('result equals the GITHUB_LANGUAGE_COLORS entry for every key in the map', () => {
    for (const [lang, expected] of Object.entries(GITHUB_LANGUAGE_COLORS)) {
      expect(deriveGithubBrandColor(lang)).toBe(expected);
    }
  });
});
