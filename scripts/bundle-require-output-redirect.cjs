// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
'use strict';

// Intercepts bundle-require's defaultGetOutputFile so its transient bundled
// config sidecar is written inside node_modules/.cache/tsup/ rather than the
// project root.
//
// Mechanism: Node.js loads .cjs files through Module._extensions['.js'].
// Hooking that loader lets us source-transform bundle-require/dist/index.cjs
// before its exports freeze (the getter for `bundleRequire` is non-configurable
// after the module initialises, making post-load mutation impossible).

const Module = require('module');
const fs     = require('fs');
const {
  BUNDLE_REQUIRE_INDEX_CJS_RE,
  applyOutputRedirect,
} = require('./bundle-require-redirect-patterns.cjs');

const _originalJsLoader = Module._extensions['.js'];

Module._extensions['.js'] = function bundleRequireOutputRedirectLoader(mod, filename) {
  if (BUNDLE_REQUIRE_INDEX_CJS_RE.test(filename)) {
    const source = fs.readFileSync(filename, 'utf8');
    mod._compile(applyOutputRedirect(source), filename);
    return;
  }
  _originalJsLoader(mod, filename);
};
