// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
'use strict';

// Must be CJS so that Module._extensions patching (also CJS-only) is in effect
// before tsup requires bundle-require.

require('./bundle-require-output-redirect.cjs');
require('../node_modules/tsup/dist/cli-default.js');
