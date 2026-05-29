// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { z } from 'zod';

export const ConfidenceLevelSchema = z.enum(['high', 'medium', 'low', 'none']);
export type ConfidenceLevel = z.infer<typeof ConfidenceLevelSchema>;

const CONFIDENCE_RANK: Record<ConfidenceLevel, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
};

export function confidenceAtLeast(
  actual: ConfidenceLevel,
  minimum: ConfidenceLevel,
): boolean {
  return CONFIDENCE_RANK[actual] >= CONFIDENCE_RANK[minimum];
}

export type CandidateField<T> = {
  value: T | null;
  confidence: ConfidenceLevel;
  source?: string;
  reason?: string;
  suggestion?: string;
};

export function highField<T>(value: T, source: string): CandidateField<T> {
  return { value, confidence: 'high', source };
}

export function mediumField<T>(
  value: T,
  source: string,
  reason?: string,
): CandidateField<T> {
  return { value, confidence: 'medium', source, ...(reason !== undefined ? { reason } : {}) };
}

export function lowField<T>(value: T, source: string, reason: string): CandidateField<T> {
  return { value, confidence: 'low', source, reason };
}

export function noneField<T>(reason: string, suggestion?: string): CandidateField<T> {
  return {
    value: null,
    confidence: 'none',
    reason,
    ...(suggestion !== undefined ? { suggestion } : {}),
  };
}
