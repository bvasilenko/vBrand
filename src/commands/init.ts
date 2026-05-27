import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirExists, ensureDir, walkFiles } from '../lib/fs.js';

const TEMPLATE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'template');

const RENAME_ON_COPY: Record<string, string> = {
  _gitignore: '.gitignore',
};

const PLACEHOLDER = '{{name}}';

export interface InitOptions {
  name?: string;
  cwd?: string;
}

export interface InitResult {
  projectDir: string;
  files: string[];
}

function toPackageName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/^-+|-+$/g, '') || 'my-brand';
}

function interpolateName(content: string, name: string): string {
  return content.split(PLACEHOLDER).join(name);
}

function copyTemplateWithInterpolation(srcDir: string, destDir: string, name: string): string[] {
  ensureDir(destDir);
  const writtenFiles: string[] = [];

  for (const srcFile of walkFiles(srcDir)) {
    const rel = srcFile.slice(srcDir.length + 1);
    const renamedRel = rel
      .split('/')
      .map((segment) => RENAME_ON_COPY[segment] ?? segment)
      .join('/');
    const destFile = join(destDir, renamedRel);

    ensureDir(dirname(destFile));

    const raw = readFileSync(srcFile);
    const isText = isTextFile(rel);
    if (isText) {
      const interpolated = interpolateName(raw.toString('utf-8'), name);
      writeFileSync(destFile, interpolated, 'utf-8');
    } else {
      writeFileSync(destFile, raw);
    }
    writtenFiles.push(renamedRel);
  }

  return writtenFiles;
}

function isTextFile(rel: string): boolean {
  const textExtensions = new Set(['.ts', '.tsx', '.js', '.json', '.html', '.css', '.md', '.txt', '.toml', '.yml', '.yaml', '.svg', '.gitignore']);
  const ext = '.' + rel.split('.').pop();
  return textExtensions.has(ext) || rel.endsWith('_gitignore');
}

export function runInit(opts: InitOptions = {}): InitResult {
  const name = toPackageName(opts.name ?? 'my-brand');
  const cwd = opts.cwd ?? process.cwd();
  const projectDir = join(cwd, name);

  if (dirExists(projectDir)) {
    throw new Error(`Directory already exists: ${projectDir}`);
  }

  const files = copyTemplateWithInterpolation(TEMPLATE_DIR, projectDir, name);

  return { projectDir, files };
}
