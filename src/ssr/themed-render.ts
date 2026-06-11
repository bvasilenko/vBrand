// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { VbrandType } from '../schema.js';
import { deriveThemeCssVars } from '../templates/content-derivers.js';
// Pre-compiled at build time so this module loads without fs.readFileSync, keeping it safe for browser bundlers.
import { TAILWIND_BUNDLE } from './tailwind-bundle.js';

function brandTokenStyleBlock(brand: VbrandType): string {
  const vars = deriveThemeCssVars(brand);
  const declarations = Object.entries(vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(';');
  return declarations.length > 0 ? `:root{${declarations}}` : '';
}

function renderBodyHtml(sections: readonly React.ReactNode[]): string {
  return renderToStaticMarkup(
    React.createElement(React.Fragment, null, ...sections),
  );
}

export function getThemedRenderHTML(
  brand: VbrandType,
  sections: readonly React.ReactNode[],
): string {
  const tokenBlock = brandTokenStyleBlock(brand);
  const headStyles = [
    `<style>${TAILWIND_BUNDLE}</style>`,
    tokenBlock.length > 0 ? `<style>${tokenBlock}</style>` : '',
  ]
    .filter(Boolean)
    .join('');
  const body = renderBodyHtml(sections);
  return (
    `<!doctype html>` +
    `<html lang="en">` +
    `<head>` +
    `<meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    headStyles +
    `</head>` +
    `<body>${body}</body>` +
    `</html>`
  );
}
