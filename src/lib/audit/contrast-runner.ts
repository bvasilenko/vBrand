// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { checkContrast } from './contrast.js';
import type { WcagGrade } from './contrast.js';
import type { VbrandType } from '../../schema.js';

export interface ContrastFinding {
  textToken: string;
  bgToken: string;
  textHex: string;
  bgHex: string;
  wcagRatio: number;
  wcagGrade: WcagGrade;
  apcaLc: number;
  apcaAdequate: boolean;
  pass: boolean;
  mode?: string;
}

const TEXT_RE = /(?:^|[-_.])(?:text|fg|foreground|on|label)(?:[-_.]|$)/i;
const BG_RE = /(?:^|[-_.])(?:bg|background|surface|canvas|fill|base)(?:[-_.]|$)/i;

function isTextToken(key: string): boolean {
  return TEXT_RE.test(key);
}

function isBgToken(key: string): boolean {
  return BG_RE.test(key);
}

function checkPairs(
  tokens: Record<string, string>,
  mode?: string,
): ContrastFinding[] {
  const findings: ContrastFinding[] = [];
  const textEntries = Object.entries(tokens).filter(([k, v]) => isTextToken(k) && /^#/.test(v));
  const bgEntries = Object.entries(tokens).filter(([k, v]) => isBgToken(k) && /^#/.test(v));

  for (const [tKey, tVal] of textEntries) {
    for (const [bKey, bVal] of bgEntries) {
      const result = checkContrast(tVal, bVal);
      const finding: ContrastFinding = {
        textToken: tKey,
        bgToken: bKey,
        textHex: tVal,
        bgHex: bVal,
        wcagRatio: result.wcagRatio,
        wcagGrade: result.wcagGrade,
        apcaLc: result.apcaLc,
        apcaAdequate: result.apcaAdequate,
        pass: result.wcagGrade !== 'fail' && result.apcaAdequate,
      };
      if (mode !== undefined) finding.mode = mode;
      findings.push(finding);
    }
  }
  return findings;
}

export function runContrastCheck(schema: VbrandType): ContrastFinding[] {
  if (schema.themes?.registry) {
    const findings: ContrastFinding[] = [];
    for (const [mode, tokens] of Object.entries(schema.themes.registry)) {
      findings.push(...checkPairs(tokens, mode));
    }
    return findings;
  }

  const colorTokens = schema.tokens?.color ?? {};
  return checkPairs(colorTokens);
}
