// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { FIXTURES, APP_TYPES, MODES, STACKS, CMS_SUBSTRATES } from './axes.mjs';

export function latinSquareSample() {
  const cells = [];
  let pairIdx = 0;
  for (const fixture of FIXTURES) {
    for (const app of APP_TYPES) {
      for (let sample = 0; sample < MODES.length; sample++) {
        cells.push({
          fixture,
          app,
          mode: MODES[(pairIdx + sample) % MODES.length],
          cms:  CMS_SUBSTRATES[(pairIdx + sample) % CMS_SUBSTRATES.length],
        });
      }
      pairIdx++;
    }
  }
  return cells.map((c, i) => ({ ...c, index: i }));
}

export function allCells() {
  const cells = [];
  let index = 0;
  for (const fixture of FIXTURES)
    for (const app of APP_TYPES)
      for (const mode of MODES)
        for (const stack of STACKS)
          for (const cms of CMS_SUBSTRATES)
            cells.push({ index: index++, fixture, app, mode, stack, cms });
  return cells;
}
