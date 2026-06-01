// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { VbrandSchema, type VbrandType } from '../../schema.js';
import { extractBrandFromHtml } from './html-brand-extractor.js';
import { loadFromFixtureHandle } from './fixture-loader.js';
import { resolveGitHubHomepage, resolveNpmHomepage } from './url-resolvers.js';
import type { BrandSourceAdapter } from './types.js';

export class BrowserBrandSourceAdapter implements BrandSourceAdapter {
  async loadFromUrl(url: string): Promise<VbrandType> {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch brand from "${url}": HTTP ${res.status}`);
    }
    const html = await res.text();
    return extractBrandFromHtml(html, url);
  }

  async loadFromGitHub(owner: string, repo: string): Promise<VbrandType> {
    const homepage = await resolveGitHubHomepage(owner, repo);
    return this.loadFromUrl(homepage);
  }

  async loadFromNpm(packageName: string): Promise<VbrandType> {
    const homepage = await resolveNpmHomepage(packageName);
    return this.loadFromUrl(homepage);
  }

  async loadFromLocalJson(_path: string): Promise<VbrandType> {
    throw new Error('loadFromLocalJson is not available in browser context.');
  }

  async loadFromCustomJson(payload: unknown): Promise<VbrandType> {
    return Promise.resolve(VbrandSchema.parse(payload));
  }

  async loadFromFixture(handle: string): Promise<VbrandType> {
    return loadFromFixtureHandle(handle);
  }
}
