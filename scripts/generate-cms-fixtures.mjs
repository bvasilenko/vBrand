// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import fs from 'node:fs';
import path from 'node:path';
import { payloadPagesFixture, payloadCollectionsFixture, sanityPagesFixture, sanitySchemaFixture, strapiPagesFixture, strapiContentTypesFixture } from '../dist/cms.js';

const OUT_DIR = path.resolve(import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname), '..', 'examples', 'demo', 'public', 'cms-fixtures');

fs.mkdirSync(OUT_DIR, { recursive: true });

const fixtures = [
  ['payload-pages.json', payloadPagesFixture()],
  ['payload-collections.json', payloadCollectionsFixture()],
  ['sanity-pages.json', sanityPagesFixture()],
  ['sanity-schema.json', sanitySchemaFixture()],
  ['strapi-pages.json', strapiPagesFixture()],
  ['strapi-content-types.json', strapiContentTypesFixture()],
];

for (const [filename, data] of fixtures) {
  fs.writeFileSync(path.join(OUT_DIR, filename), JSON.stringify(data, null, 2));
}

process.stdout.write(`CMS fixtures written to ${OUT_DIR}\n`);
