// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { ensureDir } from '../fs.js';
import { VbrandType } from '../../schema.js';

const _require = createRequire(import.meta.url);

function loadInterFont(): Buffer {
  const fontPath = _require.resolve(
    '@fontsource/inter/files/inter-latin-400-normal.woff',
  );
  return readFileSync(fontPath);
}

const INTER_FONT = loadInterFont();

function buildOgElement(brandName: string, primaryColor: string): object {
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        width: '100%',
        height: '100%',
        backgroundColor: primaryColor,
        alignItems: 'center',
        justifyContent: 'center',
        padding: '80px',
      },
      children: {
        type: 'span',
        props: {
          style: {
            color: '#ffffff',
            fontSize: 72,
            fontFamily: 'Inter',
            fontWeight: 400,
            letterSpacing: -2,
            textShadow: '0 2px 12px rgba(0,0,0,0.3)',
          },
          children: brandName,
        },
      },
    },
  };
}

export async function emitOgSatori(
  schema: VbrandType,
  outDir: string,
): Promise<string> {
  ensureDir(outDir);

  const [width, height] = schema.assets.og.dimensions;
  const primaryColor = schema.tokens.color['primary'] ?? '#0f172a';

  const svg = await satori(buildOgElement(schema.name, primaryColor) as Parameters<typeof satori>[0], {
    width,
    height,
    fonts: [
      {
        name: 'Inter',
        data: INTER_FONT,
        weight: 400,
        style: 'normal',
      },
    ],
  });

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
  });
  const rendered = resvg.render();
  const pngBuffer = rendered.asPng();

  const outPath = join(outDir, 'og.png');
  writeFileSync(outPath, pngBuffer);
  return outPath;
}
