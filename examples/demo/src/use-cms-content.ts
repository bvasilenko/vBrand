// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { useState, useEffect } from 'react';
import { getCmsSubstrate } from '@booga/vbrand/cms';
import type { ContentTree } from '@booga/vbrand/cms';
import type { CmsName } from './router';

export function useCmsContent(cms: CmsName, fixtureSlug: string | undefined): ContentTree {
  const [cmsContent, setCmsContent] = useState<ContentTree>({});

  useEffect(() => {
    let cancelled = false;
    getCmsSubstrate(cms)
      .loadContent(fixtureSlug)
      .then((tree) => {
        if (cancelled) return;
        setCmsContent(tree);
        window.__vbrand_content_tree__ = tree;
      })
      .catch(() => {
        if (cancelled) return;
        setCmsContent({});
        window.__vbrand_content_tree__ = {};
      });
    return () => { cancelled = true; };
  }, [cms, fixtureSlug]);

  return cmsContent;
}
