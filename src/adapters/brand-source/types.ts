// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import type { VbrandType } from '../../schema.js';

export interface BrandSourceAdapter {
  loadFromUrl(url: string): Promise<VbrandType>;
  loadFromGitHub(owner: string, repo: string): Promise<VbrandType>;
  loadFromNpm(packageName: string): Promise<VbrandType>;
  loadFromLocalJson(path: string): Promise<VbrandType>;
  loadFromCustomJson(payload: unknown): Promise<VbrandType>;
  loadFromFixture(handle: string): Promise<VbrandType>;
}
