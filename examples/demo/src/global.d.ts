// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import type { ContentTree } from '@booga/vbrand/cms';

declare const __VBRAND_VERSION__: string;

declare global {
  interface Window {
    __vbrand_content_tree__?: ContentTree;
  }
}

export {};
