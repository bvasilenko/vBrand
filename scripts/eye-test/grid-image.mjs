// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import sharp from 'sharp';
import { FIXTURES, APP_TYPES, MODES, STACKS } from './axes.mjs';

export const THUMB_W      = 320;
export const THUMB_H      = 200;
const        CAPTION_H    = 20;
const        LABEL_W      = 80;
const        EMIT_STRIP_W = 300;
const        CELL_H       = THUMB_H + CAPTION_H;

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function captionStrip(text, w, h, bgRgb, textRgb) {
  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${w}" height="${h}" fill="rgb(${bgRgb.join(',')})"/>
    <text x="${w / 2}" y="${h * 0.72}" font-family="monospace" font-size="9"
      text-anchor="middle" fill="rgb(${textRgb.join(',')})">${escapeXml(text)}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

const STACK_ACCENT = {
  vite:  'rgb(99,102,241)',
  next:  'rgb(234,179,8)',
  astro: 'rgb(34,197,94)',
};

async function emitShapePanel(stack, lines, w, panelH) {
  const HEADER_H = 24;
  const LINE_H   = 13;
  const PADDING  = 8;
  const accent   = STACK_ACCENT[stack] ?? 'rgb(150,150,150)';
  const codeRows = lines
    .map((line, i) => {
      const y = HEADER_H + PADDING + i * LINE_H;
      if (y > panelH - 4) return '';
      const display = line.length > 38 ? `${line.slice(0, 35)}...` : line;
      return `<text x="${PADDING}" y="${y}" font-family="monospace" font-size="10" fill="rgb(180,220,180)">${escapeXml(display)}</text>`;
    })
    .filter(Boolean)
    .join('\n    ');
  const svg = `<svg width="${w}" height="${panelH}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${w}" height="${panelH}" fill="rgb(14,18,28)"/>
    <rect width="${w}" height="${HEADER_H}" fill="rgb(20,26,38)"/>
    <rect x="0" y="0" width="3" height="${panelH}" fill="${accent}"/>
    <text x="${PADDING + 4}" y="${HEADER_H - 7}" font-family="monospace" font-size="10" font-weight="bold" fill="${accent}">${escapeXml(stack)} emit-shape</text>
    ${codeRows}
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function emitStrip(emitShapes, totalH) {
  const panelH = Math.floor(totalH / STACKS.length);
  const inputs = await Promise.all(
    STACKS.map(async (stack, i) => ({
      input: await emitShapePanel(stack, emitShapes[stack] ?? [], EMIT_STRIP_W, panelH),
      left: 0,
      top: i * panelH,
    })),
  );
  return sharp({
    create: { width: EMIT_STRIP_W, height: panelH * STACKS.length, channels: 3, background: { r: 14, g: 18, b: 28 } },
  }).composite(inputs).png().toBuffer();
}

function cellRowCol(result) {
  return {
    rowIdx: FIXTURES.indexOf(result.fixture),
    colIdx: APP_TYPES.indexOf(result.app) * MODES.length + MODES.indexOf(result.mode),
  };
}

async function standardCellCaption(result) {
  const text = result.error ? 'ERROR' : `${result.primary} cms:${result.cms}`;
  const bg   = result.error ? [120, 0, 0]      : [20, 20, 20];
  const fg   = result.error ? [255, 180, 180]   : [160, 200, 160];
  return captionStrip(text, THUMB_W, CAPTION_H, bg, fg);
}

async function exhaustiveCellCaption(result) {
  const text = result.error ? 'ERROR' : `${result.fixture}/${result.app}/${result.mode}`;
  const bg   = result.error ? [120, 0, 0]      : [20, 20, 20];
  const fg   = result.error ? [255, 180, 180]   : [120, 180, 120];
  return captionStrip(text, THUMB_W, CAPTION_H, bg, fg);
}

async function buildStandardGrid(results, emitShapes) {
  const cols   = APP_TYPES.length * MODES.length;
  const rows   = FIXTURES.length;
  const totalW = LABEL_W + cols * THUMB_W + EMIT_STRIP_W;
  const totalH = CAPTION_H + rows * CELL_H;

  const colHeaderInputs = await Promise.all(
    Array.from({ length: cols }, async (_, ci) => ({
      input: await captionStrip(
        `${APP_TYPES[Math.floor(ci / MODES.length)]}/${MODES[ci % MODES.length]}`,
        THUMB_W, CAPTION_H, [30, 30, 30], [200, 200, 200],
      ),
      left: LABEL_W + ci * THUMB_W,
      top:  0,
    })),
  );

  const rowLabelInputs = await Promise.all(
    FIXTURES.map(async (fixture, ri) => ({
      input: await captionStrip(fixture, LABEL_W, CELL_H, [20, 20, 60], [180, 200, 255]),
      left:  0,
      top:   CAPTION_H + ri * CELL_H,
    })),
  );

  const cellInputs = await Promise.all(
    results.flatMap((result) => {
      const { rowIdx, colIdx } = cellRowCol(result);
      const x      = LABEL_W + colIdx * THUMB_W;
      const yThumb = CAPTION_H + rowIdx * CELL_H;
      return [
        standardCellCaption(result).then((cap) => ({ input: cap, left: x, top: yThumb + THUMB_H })),
        Promise.resolve({ input: result.thumbnail, left: x, top: yThumb }),
      ];
    }),
  );

  const strip = await emitStrip(emitShapes, totalH);

  return sharp({
    create: { width: totalW, height: totalH, channels: 3, background: { r: 10, g: 10, b: 10 } },
  })
    .composite([...colHeaderInputs, ...rowLabelInputs, ...cellInputs, { input: strip, left: LABEL_W + cols * THUMB_W, top: 0 }])
    .png()
    .toBuffer();
}

async function buildExhaustiveGrid(results) {
  const cols   = Math.ceil(Math.sqrt(results.length));
  const rows   = Math.ceil(results.length / cols);
  const totalW = cols * THUMB_W;
  const totalH = rows * CELL_H;

  const cellInputs = await Promise.all(
    results.flatMap((result, i) => {
      const col    = i % cols;
      const row    = Math.floor(i / cols);
      const x      = col * THUMB_W;
      const yThumb = row * CELL_H;
      return [
        Promise.resolve({ input: result.thumbnail, left: x, top: yThumb }),
        exhaustiveCellCaption(result).then((cap) => ({ input: cap, left: x, top: yThumb + THUMB_H })),
      ];
    }),
  );

  return sharp({
    create: { width: totalW, height: totalH, channels: 3, background: { r: 10, g: 10, b: 10 } },
  })
    .composite(cellInputs)
    .png()
    .toBuffer();
}

export async function buildGrid(results, emitShapes, { exhaustive = false } = {}) {
  return exhaustive ? buildExhaustiveGrid(results) : buildStandardGrid(results, emitShapes);
}
