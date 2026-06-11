// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { describe, it, expect } from 'vitest';
import { FIXTURE_SLUGS } from '@booga/vfixtures';
import { ALL_FIXTURE_META, FIXTURE_PRIMARIES } from './runtime-probe/fixture-primaries.js';

const LOWERCASE_HEX_PATTERN = /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/;
const LABEL_SUFFIX = ' (fixture)';

describe('ALL_FIXTURE_META: completeness and ordering', () => {
  it('contains exactly as many entries as FIXTURE_SLUGS', () => {
    expect(ALL_FIXTURE_META.length).toBe(FIXTURE_SLUGS.length);
  });

  it('handle at each position matches the corresponding FIXTURE_SLUGS entry', () => {
    for (let i = 0; i < FIXTURE_SLUGS.length; i++) {
      expect(ALL_FIXTURE_META[i]!.handle).toBe(FIXTURE_SLUGS[i]);
    }
  });

  it('every handle is a member of FIXTURE_SLUGS', () => {
    for (const { handle } of ALL_FIXTURE_META) {
      expect(FIXTURE_SLUGS as readonly string[]).toContain(handle);
    }
  });

  it('contains no duplicate handle values', () => {
    const handles = ALL_FIXTURE_META.map((m) => m.handle);
    expect(new Set(handles).size).toBe(handles.length);
  });

  it('contains no duplicate label values', () => {
    const labels = ALL_FIXTURE_META.map((m) => m.label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe('ALL_FIXTURE_META: expectedPrimary format invariants', () => {
  it('every expectedPrimary is a non-empty string', () => {
    for (const { expectedPrimary } of ALL_FIXTURE_META) {
      expect(expectedPrimary.length).toBeGreaterThan(0);
    }
  });

  it('every expectedPrimary is fully lowercase so probe .toBe() comparisons against browser-reported values are safe', () => {
    for (const { expectedPrimary } of ALL_FIXTURE_META) {
      expect(expectedPrimary).toBe(expectedPrimary.toLowerCase());
    }
  });

  it('every expectedPrimary matches a valid CSS hex color pattern', () => {
    for (const { expectedPrimary } of ALL_FIXTURE_META) {
      expect(expectedPrimary).toMatch(LOWERCASE_HEX_PATTERN);
    }
  });
});

describe('ALL_FIXTURE_META: label format invariants', () => {
  it('every label ends with the " (fixture)" suffix', () => {
    for (const { label } of ALL_FIXTURE_META) {
      expect(label.endsWith(LABEL_SUFFIX)).toBe(true);
    }
  });

  it('every label has a non-empty brand name before the suffix', () => {
    for (const { label } of ALL_FIXTURE_META) {
      const name = label.slice(0, label.length - LABEL_SUFFIX.length);
      expect(name.length).toBeGreaterThan(0);
    }
  });
});

describe('FIXTURE_PRIMARIES: lookup consistency with ALL_FIXTURE_META', () => {
  it('has exactly as many keys as FIXTURE_SLUGS', () => {
    expect(Object.keys(FIXTURE_PRIMARIES).length).toBe(FIXTURE_SLUGS.length);
  });

  it('contains a key for every FIXTURE_SLUGS entry', () => {
    for (const slug of FIXTURE_SLUGS) {
      expect(slug in FIXTURE_PRIMARIES).toBe(true);
    }
  });

  it('FIXTURE_PRIMARIES[handle] equals ALL_FIXTURE_META expectedPrimary for every handle', () => {
    for (const { handle, expectedPrimary } of ALL_FIXTURE_META) {
      expect(FIXTURE_PRIMARIES[handle]).toBe(expectedPrimary);
    }
  });

  it('every value in FIXTURE_PRIMARIES is fully lowercase', () => {
    for (const value of Object.values(FIXTURE_PRIMARIES)) {
      expect(value).toBe(value.toLowerCase());
    }
  });
});

describe('fixture collision: fixtures sharing an identical expectedPrimary remain distinguishable', () => {
  it('fixtures with the same expectedPrimary have distinct handle values', () => {
    const byPrimary = new Map<string, string[]>();
    for (const { handle, expectedPrimary } of ALL_FIXTURE_META) {
      const group = byPrimary.get(expectedPrimary) ?? [];
      group.push(handle);
      byPrimary.set(expectedPrimary, group);
    }
    for (const handles of byPrimary.values()) {
      expect(new Set(handles).size).toBe(handles.length);
    }
  });

  it('fixtures with the same expectedPrimary have distinct label values', () => {
    const byPrimary = new Map<string, string[]>();
    for (const { label, expectedPrimary } of ALL_FIXTURE_META) {
      const group = byPrimary.get(expectedPrimary) ?? [];
      group.push(label);
      byPrimary.set(expectedPrimary, group);
    }
    for (const labels of byPrimary.values()) {
      expect(new Set(labels).size).toBe(labels.length);
    }
  });
});
