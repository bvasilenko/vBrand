// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko

const TITLE_RE = /<title>[^<]*<\/title>/;
const DESCRIPTION_PREFIX_RE = /(<meta name="description" content="vBrand)[^"]*/;

export function stampVersionIntoHtml(html, version) {
  return html
    .replace(TITLE_RE, `<title>vBrand ${version} - adaptive themed demo</title>`)
    .replace(
      DESCRIPTION_PREFIX_RE,
      `$1 ${version} adaptive themed demo: load any brand via fixture, URL, GitHub repo, or npm package; select from 4 app-type templates; edit composition live. Stack + CMS substrate + deploy-target axes flexed at WOW. fixture: sources are offline-reliable.`,
    );
}
