// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import type { ReactNode } from 'react';
import type { VbrandType } from '@booga/vbrand/adapters/browser';
import { getThemedRenderHTML } from '@booga/vbrand/ssr';

export function buildIframeSrcDoc(brand: VbrandType, sections: readonly ReactNode[]): string {
  return getThemedRenderHTML(brand, sections);
}
