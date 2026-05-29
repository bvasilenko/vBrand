// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { describe, expect, it } from 'vitest';
import { minorLineFloor } from '../src/lib/publish/semver-floor.js';

describe('minorLineFloor - stable release shapes', () => {
  it('returns the minor-line floor for a .0 release', () => {
    expect(minorLineFloor('0.2.0')).toBe('0.2.0');
  });

  it('returns the same floor for any patch within the minor line', () => {
    expect(minorLineFloor('0.2.1')).toBe('0.2.0');
    expect(minorLineFloor('0.2.5')).toBe('0.2.0');
    expect(minorLineFloor('0.2.99')).toBe('0.2.0');
  });

  it('returns a distinct floor after a minor bump', () => {
    expect(minorLineFloor('0.3.0')).toBe('0.3.0');
  });

  it('returns a distinct floor after a major bump to 1.x', () => {
    expect(minorLineFloor('1.0.0')).toBe('1.0.0');
  });

  it('handles non-zero major with non-zero minor', () => {
    expect(minorLineFloor('1.1.0')).toBe('1.1.0');
    expect(minorLineFloor('2.3.7')).toBe('2.3.0');
  });
});

describe('minorLineFloor - double-digit version components', () => {
  it('handles double-digit minor', () => {
    expect(minorLineFloor('0.10.0')).toBe('0.10.0');
  });

  it('handles patch within a double-digit minor line', () => {
    expect(minorLineFloor('0.10.9')).toBe('0.10.0');
  });

  it('handles double-digit major', () => {
    expect(minorLineFloor('10.2.0')).toBe('10.2.0');
  });

  it('handles double-digit major and double-digit minor', () => {
    expect(minorLineFloor('10.10.0')).toBe('10.10.0');
  });
});

describe('minorLineFloor - prerelease and build metadata suffixes', () => {
  it('ignores a prerelease tag on the patch component', () => {
    expect(minorLineFloor('0.2.0-beta.1')).toBe('0.2.0');
  });

  it('ignores a release-candidate prerelease tag', () => {
    expect(minorLineFloor('0.2.0-rc.1')).toBe('0.2.0');
  });

  it('ignores build metadata on the patch component', () => {
    expect(minorLineFloor('0.2.0+build.123')).toBe('0.2.0');
  });

  it('ignores a dot-separated prerelease with multiple identifiers', () => {
    expect(minorLineFloor('0.2.0-rc.1.final')).toBe('0.2.0');
  });
});

describe('minorLineFloor - npm deprecation range contract', () => {
  it('the published version is not below its own floor', () => {
    const versions = ['0.2.0', '0.3.0', '1.0.0', '1.1.0', '0.10.0'];
    for (const v of versions) {
      const floor = minorLineFloor(v);
      expect(v >= floor, `${v} must not be below its own floor ${floor}`).toBe(true);
    }
  });

  it('a prior patch is always below the next minor floor', () => {
    expect('0.1.3' < minorLineFloor('0.2.0')).toBe(true);
  });

  it('floor is strictly below the next minor floor', () => {
    expect(minorLineFloor('0.1.0') < minorLineFloor('0.2.0')).toBe(true);
  });
});
