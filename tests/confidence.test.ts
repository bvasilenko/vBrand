// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { describe, expect, it } from 'vitest';
import {
  confidenceAtLeast,
  highField,
  mediumField,
  lowField,
  noneField,
  type ConfidenceLevel,
} from '../src/lib/pull/confidence.js';

const ALL_LEVELS: ConfidenceLevel[] = ['high', 'medium', 'low', 'none'];

describe('confidenceAtLeast - total ordering properties', () => {
  it('is reflexive: every level satisfies ≥ itself', () => {
    for (const level of ALL_LEVELS) {
      expect(confidenceAtLeast(level, level)).toBe(true);
    }
  });

  it('high ≥ every level', () => {
    for (const min of ALL_LEVELS) {
      expect(confidenceAtLeast('high', min)).toBe(true);
    }
  });

  it('none satisfies ≥ only none', () => {
    expect(confidenceAtLeast('none', 'none')).toBe(true);
    expect(confidenceAtLeast('none', 'low')).toBe(false);
    expect(confidenceAtLeast('none', 'medium')).toBe(false);
    expect(confidenceAtLeast('none', 'high')).toBe(false);
  });

  it('strict ascending chain: none < low < medium < high', () => {
    expect(confidenceAtLeast('low',    'none'  )).toBe(true);
    expect(confidenceAtLeast('medium', 'low'   )).toBe(true);
    expect(confidenceAtLeast('high',   'medium')).toBe(true);
  });

  it('descending pairs are false', () => {
    expect(confidenceAtLeast('none',   'low'   )).toBe(false);
    expect(confidenceAtLeast('low',    'medium')).toBe(false);
    expect(confidenceAtLeast('medium', 'high'  )).toBe(false);
  });

  it('is transitive: high ≥ medium ≥ low implies high ≥ low', () => {
    expect(confidenceAtLeast('high', 'low')).toBe(true);
  });

  it.each<[ConfidenceLevel, ConfidenceLevel, boolean]>([
    ['high',   'high',   true  ],
    ['high',   'medium', true  ],
    ['high',   'low',    true  ],
    ['high',   'none',   true  ],
    ['medium', 'high',   false ],
    ['medium', 'medium', true  ],
    ['medium', 'low',    true  ],
    ['medium', 'none',   true  ],
    ['low',    'high',   false ],
    ['low',    'medium', false ],
    ['low',    'low',    true  ],
    ['low',    'none',   true  ],
    ['none',   'high',   false ],
    ['none',   'medium', false ],
    ['none',   'low',    false ],
    ['none',   'none',   true  ],
  ])('confidenceAtLeast(%s, %s) === %s', (actual, minimum, expected) => {
    expect(confidenceAtLeast(actual, minimum)).toBe(expected);
  });
});

describe('highField - factory', () => {
  it('sets confidence to high', () => {
    expect(highField('x', 'og:site_name').confidence).toBe('high');
  });

  it('preserves value exactly', () => {
    const value = { nested: [1, 2] };
    expect(highField(value, 'src').value).toBe(value);
  });

  it('sets source', () => {
    expect(highField('v', 'theme-color-meta').source).toBe('theme-color-meta');
  });

  it('has no reason or suggestion', () => {
    const f = highField('v', 'src');
    expect(f.reason).toBeUndefined();
    expect(f.suggestion).toBeUndefined();
  });

  it('works for non-string values (number, object, array)', () => {
    expect(highField(42, 'src').value).toBe(42);
    expect(highField({ a: 1 }, 'src').value).toEqual({ a: 1 });
    expect(highField([1, 2], 'src').value).toEqual([1, 2]);
  });
});

describe('mediumField - factory', () => {
  it('sets confidence to medium', () => {
    expect(mediumField('v', 'title').confidence).toBe('medium');
  });

  it('sets source', () => {
    expect(mediumField('v', 'og:title').source).toBe('og:title');
  });

  it('includes reason when provided', () => {
    expect(mediumField('v', 's', 'no-og').reason).toBe('no-og');
  });

  it('omits reason when not provided', () => {
    expect(mediumField('v', 's').reason).toBeUndefined();
  });

  it('has no suggestion', () => {
    expect(mediumField('v', 's', 'r').suggestion).toBeUndefined();
  });
});

describe('lowField - factory', () => {
  it('sets confidence to low', () => {
    expect(lowField('v', 'src', 'reason').confidence).toBe('low');
  });

  it('sets source and reason', () => {
    const f = lowField('v', 'hostname', 'no-name-meta');
    expect(f.source).toBe('hostname');
    expect(f.reason).toBe('no-name-meta');
  });

  it('has no suggestion', () => {
    expect(lowField('v', 's', 'r').suggestion).toBeUndefined();
  });

  it('preserves arbitrary value types', () => {
    const obj = { key: 'val' };
    expect(lowField(obj, 'src', 'heuristic').value).toBe(obj);
  });
});

describe('noneField - factory', () => {
  it('sets confidence to none', () => {
    expect(noneField('absent-in-source').confidence).toBe('none');
  });

  it('always has null value', () => {
    expect(noneField<string>('r').value).toBeNull();
    expect(noneField<number[]>('r', 's').value).toBeNull();
  });

  it('sets reason', () => {
    expect(noneField('dynamic-render-required').reason).toBe('dynamic-render-required');
  });

  it('includes suggestion when provided', () => {
    expect(noneField('download-failed', '--logo <path>').suggestion).toBe('--logo <path>');
  });

  it('omits suggestion when not provided', () => {
    expect(noneField('absent-in-source').suggestion).toBeUndefined();
  });

  it('has no source', () => {
    expect(noneField('r').source).toBeUndefined();
  });
});

describe('CandidateField shape invariants', () => {
  it('all factories produce objects with value + confidence keys', () => {
    const fields = [
      highField('v', 's'),
      mediumField('v', 's'),
      lowField('v', 's', 'r'),
      noneField('r'),
    ];
    for (const f of fields) {
      expect('value' in f).toBe(true);
      expect('confidence' in f).toBe(true);
    }
  });

  it('only noneField produces null value', () => {
    expect(highField<string | null>(null, 's').value).toBeNull();
    expect(noneField<string>('r').value).toBeNull();
  });
});
