// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { describe, it, expect } from 'vitest';
import { mergeContentLayers } from '../src/content-layers.js';
import type { ContentTree } from '@booga/vbrand/cms';
import type { ContentOverrideMap } from '@booga/vbrand/content';

type Key = keyof ContentOverrideMap;

const KEY_A = 'landing.hero.heading' as Key;
const KEY_B = 'landing.hero.subheading' as Key;
const KEY_C = 'marketing.intro.heading' as Key;

const CMS_A: ContentTree = { [KEY_A]: 'cms-a' } as ContentTree;
const CMS_AB: ContentTree = { [KEY_A]: 'cms-a', [KEY_B]: 'cms-b' } as ContentTree;
const CMS_ABC: ContentTree = { [KEY_A]: 'cms-a', [KEY_B]: 'cms-b', [KEY_C]: 'cms-c' } as ContentTree;

const USER_A: ContentOverrideMap = { [KEY_A]: 'user-a' } as ContentOverrideMap;
const USER_B: ContentOverrideMap = { [KEY_B]: 'user-b' } as ContentOverrideMap;
const USER_AB: ContentOverrideMap = { [KEY_A]: 'user-a', [KEY_B]: 'user-b' } as ContentOverrideMap;

describe('mergeContentLayers: empty inputs', () => {
  it('returns an empty object when both layers are empty', () => {
    expect(mergeContentLayers({}, {})).toEqual({});
  });

  it('returns a copy of cmsContent when userContent is empty', () => {
    expect(mergeContentLayers(CMS_AB, {})).toEqual(CMS_AB);
  });

  it('returns a copy of userContent when cmsContent is empty', () => {
    expect(mergeContentLayers({}, USER_AB)).toEqual(USER_AB);
  });
});

describe('mergeContentLayers: layer priority', () => {
  it('userContent value wins when both layers have the same key', () => {
    const result = mergeContentLayers(CMS_A, USER_A);
    expect(result[KEY_A]).toBe('user-a');
  });

  it('cmsContent value appears for a key absent from userContent', () => {
    const result = mergeContentLayers(CMS_AB, USER_A);
    expect(result[KEY_B]).toBe('cms-b');
  });

  it('userContent value appears for a key absent from cmsContent', () => {
    const result = mergeContentLayers(CMS_A, USER_B);
    expect(result[KEY_B]).toBe('user-b');
  });

  it('both layers contribute their respective keys to the result', () => {
    const result = mergeContentLayers(CMS_A, USER_B);
    expect(result[KEY_A]).toBe('cms-a');
    expect(result[KEY_B]).toBe('user-b');
  });

  it('userContent fully overrides all shared keys when all keys overlap', () => {
    const result = mergeContentLayers(CMS_AB, USER_AB);
    expect(result[KEY_A]).toBe('user-a');
    expect(result[KEY_B]).toBe('user-b');
  });

  it('cmsContent keys absent from userContent survive a full-key userContent merge', () => {
    const result = mergeContentLayers(CMS_ABC, USER_AB);
    expect(result[KEY_C]).toBe('cms-c');
    expect(result[KEY_A]).toBe('user-a');
    expect(result[KEY_B]).toBe('user-b');
  });
});

describe('mergeContentLayers: output shape', () => {
  it('result key count equals union of both layers when there is no overlap', () => {
    const result = mergeContentLayers(CMS_A, USER_B);
    expect(Object.keys(result)).toHaveLength(2);
  });

  it('result key count equals shared key count when layers are identical', () => {
    const result = mergeContentLayers(CMS_AB, USER_AB);
    expect(Object.keys(result)).toHaveLength(2);
  });

  it('result key count equals cmsContent key count when userContent is empty', () => {
    const result = mergeContentLayers(CMS_ABC, {});
    expect(Object.keys(result)).toHaveLength(3);
  });

  it('result key count equals userContent key count when cmsContent is empty', () => {
    const result = mergeContentLayers({}, USER_AB);
    expect(Object.keys(result)).toHaveLength(2);
  });
});

describe('mergeContentLayers: immutability', () => {
  it('does not mutate cmsContent', () => {
    const cms: ContentTree = { [KEY_A]: 'original' } as ContentTree;
    mergeContentLayers(cms, USER_A);
    expect(cms[KEY_A]).toBe('original');
  });

  it('does not mutate userContent', () => {
    const user: ContentOverrideMap = { [KEY_B]: 'original' } as ContentOverrideMap;
    mergeContentLayers(CMS_AB, user);
    expect(user[KEY_B]).toBe('original');
  });

  it('returns a new object distinct from both inputs', () => {
    const cms: ContentTree = { [KEY_A]: 'cms' } as ContentTree;
    const user: ContentOverrideMap = { [KEY_B]: 'user' } as ContentOverrideMap;
    const result = mergeContentLayers(cms, user);
    expect(result).not.toBe(cms);
    expect(result).not.toBe(user);
  });
});

describe('mergeContentLayers: multiple calls produce consistent results', () => {
  it('same inputs always produce equal outputs', () => {
    expect(mergeContentLayers(CMS_AB, USER_A)).toEqual(mergeContentLayers(CMS_AB, USER_A));
  });

  it('successive calls with swapped userContent reflect the latest userContent', () => {
    const first = mergeContentLayers(CMS_A, USER_A);
    const second = mergeContentLayers(CMS_A, USER_B);
    expect(first[KEY_A]).toBe('user-a');
    expect(second[KEY_A]).toBe('cms-a');
    expect(second[KEY_B]).toBe('user-b');
  });

  it('cmsContent change is reflected when userContent stays the same', () => {
    const first = mergeContentLayers({ [KEY_A]: 'v1' } as ContentTree, {});
    const second = mergeContentLayers({ [KEY_A]: 'v2' } as ContentTree, {});
    expect(first[KEY_A]).toBe('v1');
    expect(second[KEY_A]).toBe('v2');
  });
});

describe('mergeContentLayers: array-type values (ContentOverrideValue = string | string[])', () => {
  it('array CMS value appears in result when userContent does not override it', () => {
    const cms = { [KEY_A]: ['first', 'second'] } as unknown as ContentTree;
    expect(mergeContentLayers(cms, {})[KEY_A]).toEqual(['first', 'second']);
  });

  it('array user value replaces a string CMS value for the same key', () => {
    const cms = { [KEY_A]: 'string-from-cms' } as ContentTree;
    const user = { [KEY_A]: ['array', 'from', 'user'] } as unknown as ContentOverrideMap;
    expect(mergeContentLayers(cms, user)[KEY_A]).toEqual(['array', 'from', 'user']);
  });

  it('string user value replaces an array CMS value for the same key', () => {
    const cms = { [KEY_A]: ['array', 'from', 'cms'] } as unknown as ContentTree;
    const user = { [KEY_A]: 'string-from-user' } as ContentOverrideMap;
    expect(mergeContentLayers(cms, user)[KEY_A]).toBe('string-from-user');
  });

  it('array user value replaces an array CMS value and the original CMS array is not mutated', () => {
    const original = ['cms-item-1', 'cms-item-2'];
    const cms = { [KEY_A]: original } as unknown as ContentTree;
    const user = { [KEY_A]: ['user-item'] } as unknown as ContentOverrideMap;
    mergeContentLayers(cms, user);
    expect(original).toEqual(['cms-item-1', 'cms-item-2']);
  });

  it('single-element array is preserved as an array, not flattened to a string', () => {
    const cms = { [KEY_A]: ['only'] } as unknown as ContentTree;
    expect(Array.isArray(mergeContentLayers(cms, {})[KEY_A])).toBe(true);
  });
});

describe('mergeContentLayers: empty string values', () => {
  it('empty string CMS value appears in result when userContent does not override it', () => {
    const cms = { [KEY_A]: '' } as ContentTree;
    expect(mergeContentLayers(cms, {})[KEY_A]).toBe('');
  });

  it('empty string user value replaces a non-empty CMS value for the same key', () => {
    const cms = { [KEY_A]: 'populated-by-cms' } as ContentTree;
    const user = { [KEY_A]: '' } as ContentOverrideMap;
    expect(mergeContentLayers(cms, user)[KEY_A]).toBe('');
  });

  it('empty string CMS value is still overridable by a non-empty user value', () => {
    const cms = { [KEY_A]: '' } as ContentTree;
    const user = { [KEY_A]: 'filled-by-user' } as ContentOverrideMap;
    expect(mergeContentLayers(cms, user)[KEY_A]).toBe('filled-by-user');
  });

  it('two empty string values for the same key merge to an empty string result', () => {
    const cms = { [KEY_A]: '' } as ContentTree;
    const user = { [KEY_A]: '' } as ContentOverrideMap;
    expect(mergeContentLayers(cms, user)[KEY_A]).toBe('');
  });

  it('an empty string value does not suppress other keys from either layer', () => {
    const cms = { [KEY_A]: '', [KEY_B]: 'cms-b' } as ContentTree;
    const user = { [KEY_A]: '' } as ContentOverrideMap;
    const result = mergeContentLayers(cms, user);
    expect(result[KEY_A]).toBe('');
    expect(result[KEY_B]).toBe('cms-b');
  });
});
