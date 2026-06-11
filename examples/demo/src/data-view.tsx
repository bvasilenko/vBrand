// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import React from 'react';
import type { VbrandType } from '@booga/vbrand/adapters/browser';
import { Stack, Inline, Box, Pill, Card, CardHeader, CardTitle, CardContent } from '@booga/vui';
import type { BrandMeta } from './brand-loader';

interface DataViewProps {
  brand: VbrandType;
  sourceLabel: string;
  meta: BrandMeta;
}

export function DataView({ brand, sourceLabel, meta }: DataViewProps) {
  const colorCount = Object.keys(brand.tokens.color).length;
  const typeCount = Object.keys(brand.tokens.type).length;
  const faviconSource = brand.assets.favicon.source;
  // cross-origin fetch fails on gh-pages for external favicon URLs
  const faviconIsBundled = meta.faviconBundled && !/^[a-z]+:\/\//i.test(faviconSource);

  return (
    <Box as="section" style={{ padding: '32px', maxWidth: '900px', margin: '0 auto' }}>
      <Stack gap={6}>
        <Inline wrap gap={2}>
          <Pill tone="meta">source: {sourceLabel}</Pill>
          <Pill tone="ok">VbrandSchema valid</Pill>
          <Pill tone="info">{colorCount} color tokens</Pill>
          <Pill tone="info">{typeCount} type tokens</Pill>
          {meta.githubColorFallback && (
            <Pill tone="warn">GitHub source: no brand color derived; using fallback</Pill>
          )}
          {meta.colorFallbackActive && !meta.githubColorFallback && (
            <Pill tone="warn">color fallback active</Pill>
          )}
          {meta.faviconBundled && (
            <Pill tone="info">favicon bundled</Pill>
          )}
        </Inline>

        <Card>
          <CardHeader><CardTitle>Identity</CardTitle></CardHeader>
          <CardContent>
            <Stack gap={2}>
              <div><strong>name:</strong> {brand.name}</div>
              <div><strong>canonical voice:</strong> {brand.voice.canonical}</div>
              <div><strong>repo description:</strong> {brand.voice.repoDescription}</div>
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Color tokens ({colorCount})</CardTitle></CardHeader>
          <CardContent>
            <Inline wrap gap={2}>
              {Object.entries(brand.tokens.color).map(([key, value]) => (
                <Inline key={key} gap={1} align="center">
                  <span
                    style={{
                      width: '16px', height: '16px', borderRadius: '3px',
                      background: value, border: '1px solid #e5e7eb', flexShrink: 0,
                    }}
                  />
                  <code style={{ fontSize: '0.75rem' }}>{key}: {value}</code>
                </Inline>
              ))}
              {colorCount === 0 && (
                <Pill tone="warn">no color tokens extracted</Pill>
              )}
            </Inline>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Typography tokens ({typeCount})</CardTitle></CardHeader>
          <CardContent>
            <Stack gap={2}>
              {Object.entries(brand.tokens.type).map(([key, value]) => (
                <div key={key} style={{ fontSize: '0.8125rem' }}>
                  <code>{key}</code>: {value}
                </div>
              ))}
              {typeCount === 0 && (
                <Pill tone="warn">no type tokens extracted</Pill>
              )}
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Assets</CardTitle></CardHeader>
          <CardContent>
            <Stack gap={2}>
              <Inline gap={2} align="center">
                <strong>favicon:</strong>
                {faviconIsBundled && (
                  <img
                    src={faviconSource}
                    alt={`${brand.name} favicon`}
                    width={20}
                    height={20}
                    style={{ display: 'block', borderRadius: '3px' }}
                  />
                )}
                <code>{faviconSource}</code>
                <span>[{brand.assets.favicon.sizes.join(', ')}]</span>
              </Inline>
              <div><strong>og dimensions:</strong> {brand.assets.og.dimensions.join(' x ')}</div>
              {brand.assets.og.source && (
                <div><strong>og source:</strong> <code>{brand.assets.og.source}</code></div>
              )}
              <div><strong>icons source:</strong> <code>{brand.assets.icons.source}</code></div>
              {brand.assets.icons.set.length > 0 && (
                <div><strong>icon set:</strong> {brand.assets.icons.set.length} item(s)</div>
              )}
            </Stack>
          </CardContent>
        </Card>

        {brand.sources && brand.sources.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Sources ({brand.sources.length})</CardTitle></CardHeader>
            <CardContent>
              <Stack gap={1}>
                {brand.sources.map((s) => (
                  <div key={s}><a href={s} target="_blank" rel="noreferrer">{s}</a></div>
                ))}
              </Stack>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle>Raw VbrandType</CardTitle></CardHeader>
          <CardContent>
            <pre
              style={{
                fontSize: '0.75rem', overflow: 'auto', maxHeight: '400px',
                background: 'var(--color-neutral-50, #f9fafb)', padding: '12px', borderRadius: '4px',
                margin: 0, lineHeight: 1.5,
              }}
            >
              {JSON.stringify(brand, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}
