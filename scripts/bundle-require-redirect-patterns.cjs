// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
'use strict';

const BUNDLE_REQUIRE_INDEX_CJS_RE =
  /node_modules[/\\]bundle-require[/\\]dist[/\\]index\.cjs$/;

// Matches the multi-line defaultGetOutputFile arrow function in bundle-require's
// dist artifact.  The lazy [\s\S]*? stops at the first ); that closes the
// outer filepath.replace() call.  Non-self-matching: the redirected form uses
// a block body ({ ... }) while the original uses a concise body (filepath.replace).
const ORIGINAL_OUTPUT_FN_RE =
  /var defaultGetOutputFile = \(filepath, format\) => filepath\.replace\([\s\S]*?\);/;

const CACHE_RELATIVE_PATH = 'node_modules/.cache/tsup';

// Replacement references JS_EXT_RE and getRandomId() from the bundle-require
// module closure — both are defined earlier in the same compiled output.
const REDIRECTED_OUTPUT_FN = `\
var defaultGetOutputFile = (filepath, format) => {
  var _p = require("path"), _f = require("fs");
  var _dir = _p.resolve(process.cwd(), "${CACHE_RELATIVE_PATH}");
  _f.mkdirSync(_dir, { recursive: true });
  return _p.join(
    _dir,
    _p.basename(filepath).replace(JS_EXT_RE, ".bundled_" + getRandomId() + "." + (format === "esm" ? "mjs" : "cjs"))
  );
};`;

function applyOutputRedirect(source) {
  return source.replace(ORIGINAL_OUTPUT_FN_RE, REDIRECTED_OUTPUT_FN);
}

module.exports = {
  BUNDLE_REQUIRE_INDEX_CJS_RE,
  ORIGINAL_OUTPUT_FN_RE,
  CACHE_RELATIVE_PATH,
  REDIRECTED_OUTPUT_FN,
  applyOutputRedirect,
};
