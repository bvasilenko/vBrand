// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { readFileSync } from 'node:fs';
import { fileExists } from '../lib/fs.js';
import { ClassifyReport, classifyHtml } from '../lib/html.js';

export interface ClassifyOptions {
  htmlPath: string;
}

export function runClassify(opts: ClassifyOptions): ClassifyReport {
  if (!fileExists(opts.htmlPath)) {
    throw new Error(`HTML file not found: ${opts.htmlPath}`);
  }
  const html = readFileSync(opts.htmlPath, 'utf-8');
  return classifyHtml(opts.htmlPath, html);
}
