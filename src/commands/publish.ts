// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { join } from 'node:path';
import { SCHEMA_FILENAME } from '../schema.js';
import { loadSchema } from '../lib/schema-io.js';
import { writeRegistryItem } from '../lib/publish/registry-item.js';
import { writeDtcgBundle, DTCG_EXPERIMENTAL_NOTICE } from '../lib/publish/dtcg-bundle.js';
import { writeNpmShape } from '../lib/publish/npm-shape.js';

export type PublishAs = 'registry-item' | 'dtcg' | 'npm';

export interface PublishOptions {
  cwd?: string;
  schemaPath?: string;
  as?: PublishAs;
  experimental?: boolean;
  version?: string;
}

export interface PublishResult {
  files: string[];
  format: PublishAs;
  notice?: string;
}

const PACKAGE_VERSION = '0.2.0';

export async function runPublish(opts: PublishOptions = {}): Promise<PublishResult> {
  const cwd = opts.cwd ?? process.cwd();
  const schemaPath = opts.schemaPath ?? join(cwd, SCHEMA_FILENAME);
  const format = opts.as ?? 'registry-item';
  const version = opts.version ?? PACKAGE_VERSION;
  const distDir = join(cwd, 'dist');

  const schema = loadSchema(schemaPath);

  switch (format) {
    case 'registry-item': {
      const outPath = writeRegistryItem(schema, version, distDir);
      return { files: [outPath], format };
    }

    case 'dtcg': {
      if (!opts.experimental) {
        throw new Error(
          `--as=dtcg requires the --experimental flag.\n${DTCG_EXPERIMENTAL_NOTICE}`,
        );
      }
      const outPath = writeDtcgBundle(schema, distDir);
      return { files: [outPath], format, notice: DTCG_EXPERIMENTAL_NOTICE };
    }

    case 'npm': {
      const files = writeNpmShape(schema, version, distDir);
      return { files, format };
    }
  }
}
