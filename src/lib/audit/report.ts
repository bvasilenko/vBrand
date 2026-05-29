// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ensureDir } from '../fs.js';
import type { AxeFinding } from './axe-runner.js';
import type { SlotFinding } from './slot-checker.js';
import type { AlignmentDrift } from './alignment.js';
import type { ContrastFinding } from './contrast-runner.js';
import type { MarksFinding } from './marks-geometry.js';

export interface AuditReportData {
  schemaPath: string;
  drifted: string[];
  axeFindings: AxeFinding[];
  slotFindings: SlotFinding[];
  alignmentDrifts: AlignmentDrift[];
  contrastFindings?: ContrastFinding[];
  marksFindings?: MarksFinding[];
  againstSource?: string;
  strict: boolean;
  exitCode: 0 | 1;
}

function formatDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function axeTable(findings: AxeFinding[]): string {
  if (findings.length === 0) return '_None_';
  const rows = findings.map(
    (f) => `| ${f.ruleId} | ${f.impact} | ${f.nodeCount} | ${f.help} |`,
  );
  return [
    '| Rule | Impact | Nodes | Help |',
    '|---|---|---|---|',
    ...rows,
  ].join('\n');
}

function driftList(drifted: string[]): string {
  if (drifted.length === 0) return '_None_';
  return drifted.map((d) => `- \`${d}\``).join('\n');
}

function slotList(findings: SlotFinding[]): string {
  if (findings.length === 0) return '_None_';
  return findings.map((f) => `- \`${f.slotName}\` (${f.reason})`).join('\n');
}

function alignmentList(drifts: AlignmentDrift[]): string {
  if (drifts.length === 0) return '_None_';
  return drifts
    .map((d) => `- \`${d.field}\`: schema=\`${d.schemaValue}\` external=\`${d.externalValue}\``)
    .join('\n');
}

function contrastTable(findings: ContrastFinding[]): string {
  if (findings.length === 0) return '_None_';
  const rows = findings.map(
    (f) =>
      `| ${f.mode ?? '-'} | \`${f.textToken}\` | \`${f.bgToken}\` | ${f.wcagRatio} | ${f.wcagGrade} | ${f.apcaLc} | ${f.pass ? 'pass' : '**fail**'} |`,
  );
  return [
    '| Mode | Text token | BG token | WCAG ratio | WCAG grade | APCA Lc | Result |',
    '|---|---|---|---|---|---|---|',
    ...rows,
  ].join('\n');
}

function marksList(findings: MarksFinding[]): string {
  if (findings.length === 0) return '_None_';
  return findings.map((f) => `- \`${f.source}\` (${f.reason}): ${f.detail}`).join('\n');
}

export function writeAuditReport(data: AuditReportData, reportsDir: string): string {
  ensureDir(reportsDir);

  const date = formatDate();
  const timestamp = new Date().toISOString();
  const filename = `audit-${date}.md`;
  const outPath = join(reportsDir, filename);

  const lines = [
    `---`,
    `date: "${timestamp}"`,
    `schema: "${data.schemaPath}"`,
    `strict: ${data.strict}`,
    `exit_code: ${data.exitCode}`,
    `---`,
    ``,
    `# Brand Audit: ${date}`,
    ``,
    `## Asset Drift`,
    ``,
    driftList(data.drifted),
    ``,
    `## Accessibility (axe-core)`,
    ``,
    axeTable(data.axeFindings),
    ``,
    `## Slot Completeness`,
    ``,
    slotList(data.slotFindings),
    ``,
    `## Contrast (WCAG + APCA)`,
    ``,
    contrastTable(data.contrastFindings ?? []),
    ``,
    `## Brand Marks Geometry`,
    ``,
    marksList(data.marksFindings ?? []),
  ];

  if (data.againstSource) {
    lines.push(``, `## Alignment vs \`${data.againstSource}\``, ``, alignmentList(data.alignmentDrifts));
  }

  lines.push(``, `---`, ``, `Exit code: ${data.exitCode}`);

  writeFileSync(outPath, lines.join('\n'), 'utf-8');
  return outPath;
}
