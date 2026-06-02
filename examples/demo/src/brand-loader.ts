// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { BrowserBrandSourceAdapter } from '@booga/vbrand/adapters/browser';
import type { VbrandType } from '@booga/vbrand/adapters/browser';
import type { BrandParams } from './router';

const adapter = new BrowserBrandSourceAdapter();

export function loadBrand(params: BrandParams): Promise<VbrandType> {
  switch (params.type) {
    case 'fixture':     return adapter.loadFromFixture(params.handle);
    case 'url':         return adapter.loadFromUrl(params.url);
    case 'github':      return adapter.loadFromGitHub(params.owner, params.repo);
    case 'npm':         return adapter.loadFromNpm(params.pkg);
    case 'json':        return adapter.loadFromCustomJson(params.payload);
    case 'parse-error': return Promise.reject(new Error(params.reason));
  }
}
