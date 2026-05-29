// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ensureDir } from '../fs.js';
import { VbrandType } from '../../schema.js';

function yamlFrontmatter(schema: VbrandType): string {
  const lines = [
    '---',
    `name: "${schema.name}"`,
    `version: "0.2.0"`,
    `generated: "${new Date().toISOString().slice(0, 10)}"`,
    `primary_color: "${schema.tokens.color['primary'] ?? ''}"`,
    `voice_canonical: "${schema.voice.canonical.replace(/"/g, '\\"')}"`,
    '---',
  ];
  return lines.join('\n');
}

function colorTable(colors: Record<string, string>): string {
  const rows = Object.keys(colors)
    .sort()
    .map((k) => `| ${k} | ${colors[k]} |`);
  return [
    '| Token | Value |',
    '|---|---|',
    ...rows,
  ].join('\n');
}

function typographyTable(type: Record<string, string>): string {
  const rows = Object.keys(type)
    .sort()
    .map((k) => `| ${k} | ${type[k]} |`);
  return [
    '| Token | Stack |',
    '|---|---|',
    ...rows,
  ].join('\n');
}

export function emitDesignDoc(schema: VbrandType, outDir: string): string {
  ensureDir(outDir);

  const sections: string[] = [
    yamlFrontmatter(schema),
    '',
    `# ${schema.name}: Brand Contract`,
    '',
    schema.voice.canonical,
    '',
    '## Colors',
    '',
    colorTable(schema.tokens.color),
    '',
    '## Typography',
    '',
    typographyTable(schema.tokens.type),
  ];

  if (schema.marks) {
    sections.push('', '## Brand Marks');
    if (schema.marks.logoMinWidth) {
      sections.push(``, `- Minimum logo width: ${schema.marks.logoMinWidth}px`);
    }
    if (schema.marks.logoAspectRatio) {
      sections.push(`- Aspect ratio: ${schema.marks.logoAspectRatio}`);
    }
    if (schema.marks.safeZoneRatio) {
      sections.push(`- Safe zone: ${schema.marks.safeZoneRatio}x logo size`);
    }
  }

  if (schema.themes?.modes) {
    sections.push('', '## Themes', '', `Modes: ${schema.themes.modes.join(', ')}`);
  }

  const md = sections.join('\n').trimEnd() + '\n';
  const outPath = join(outDir, 'DESIGN.md');
  writeFileSync(outPath, md, 'utf-8');
  return outPath;
}
