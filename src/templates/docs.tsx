// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import React from 'react';
import { Box, Stack, Card, CardContent, Separator } from '@booga/vui';
import type { VbrandType } from '../schema.js';
import type { CompositionSpec } from '../composition/spec.js';
import { visibleSections } from '../composition/spec.js';
import type { AppTypeTemplate, ContentOverrideMap } from './types.js';
import {
  deriveDocsSidebarContent,
  deriveDocsArticleContent,
  deriveDocsTocContent,
} from './content-derivers.js';
import { applyContentOverride } from '../content/apply.js';
import { markIsland } from '../interactivity/islands.js';

const SECTION_IDS = ['sidebar', 'article', 'toc'] as const;
type DocsSectionId = (typeof SECTION_IDS)[number];

type DocsSidebarContent = ReturnType<typeof deriveDocsSidebarContent>;
type DocsArticleContent = ReturnType<typeof deriveDocsArticleContent>;
type DocsTocContent = ReturnType<typeof deriveDocsTocContent>;

export const docsTemplate: AppTypeTemplate = {
  templateId: () => 'docs',

  defaultComposition: () => ({
    sections: SECTION_IDS.map((id, i) => ({
      id,
      visible: true,
      density: 'regular' as const,
      order: i,
    })),
  }),

  compose(brand: VbrandType, composition: CompositionSpec, content?: ContentOverrideMap) {
    const visible = visibleSections(composition);
    const activeSections = visible.filter((s): s is typeof s & { id: DocsSectionId } =>
      (SECTION_IDS as readonly string[]).includes(s.id),
    );

    const hasSidebar = activeSections.some((s) => s.id === 'sidebar');
    const hasToc = activeSections.some((s) => s.id === 'toc');
    const hasArticle = activeSections.some((s) => s.id === 'article');

    const sidebarContent = applyContentOverride(deriveDocsSidebarContent(brand), content, 'docs.sidebar');
    const articleContent = applyContentOverride(deriveDocsArticleContent(brand), content, 'docs.article');
    const tocContent = applyContentOverride(deriveDocsTocContent(brand), content, 'docs.toc');

    return (
      <Box
        as="div"
        style={{
          display: 'flex',
          minHeight: '100vh',
          fontFamily: `var(--type-body, system-ui)`,
        }}
      >
        {hasSidebar && <DocsSidebar content={sidebarContent} />}
        <Box as="main" style={{ flex: 1, padding: '32px', maxWidth: '800px' }}>
          {hasArticle && <DocsArticle brand={brand} content={articleContent} />}
        </Box>
        {hasToc && markIsland(<DocsToc content={tocContent} />, 'docs.toc')}
      </Box>
    );
  },
};

function DocsSidebar({ content }: { content: DocsSidebarContent }) {
  const navItems = [
    { label: 'Overview', href: '#overview' },
    { label: 'Voice', href: '#voice' },
    { label: 'Color tokens', href: '#colors' },
    { label: 'Typography', href: '#type' },
    { label: 'Assets', href: '#assets' },
  ];

  return (
    <Box
      as="nav"
      style={{
        width: '240px',
        minHeight: '100vh',
        padding: '24px 16px',
        borderRight: '1px solid var(--color-neutral-200, #e5e7eb)',
        background: 'var(--color-neutral-50, #f9fafb)',
        flexShrink: 0,
      }}
    >
      <Stack style={{ gap: '16px' }}>
        <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-primary, #6366f1)' }}>
          {content.heading}
        </span>
        <Separator />
        <Stack style={{ gap: '4px' }}>
          {navItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              style={{
                display: 'block',
                padding: '6px 8px',
                fontSize: '0.875rem',
                borderRadius: '4px',
                textDecoration: 'none',
                color: 'var(--color-neutral-700, #374151)',
              }}
            >
              {item.label}
            </a>
          ))}
        </Stack>
      </Stack>
    </Box>
  );
}

function DocsArticle({ brand, content }: { brand: VbrandType; content: DocsArticleContent }) {
  return (
    <Stack style={{ gap: '24px' }}>
      <Stack id="overview" style={{ gap: '8px' }}>
        <h1 style={{ fontFamily: `var(--type-heading, system-ui)`, margin: 0 }}>{content.title}</h1>
        <p style={{ color: 'var(--color-neutral-500, #6b7280)', margin: 0 }}>{content.subtitle}</p>
      </Stack>
      <Separator />
      <Stack id="voice" style={{ gap: '12px' }}>
        <h2 style={{ margin: 0 }}>Voice</h2>
        <Card>
          <CardContent>
            <Stack style={{ gap: '8px' }}>
              <p><strong>Canonical:</strong> {content.canonicalVoice}</p>
              <p><strong>Description:</strong> {content.repoDescription}</p>
            </Stack>
          </CardContent>
        </Card>
      </Stack>
      <Stack id="colors" style={{ gap: '12px' }}>
        <h2 style={{ margin: 0 }}>Color tokens</h2>
        <Stack style={{ gap: '8px' }}>
          {Object.entries(brand.tokens.color).map(([key, value]) => (
            <ColorRow key={key} name={key} value={value} />
          ))}
        </Stack>
      </Stack>
      <Stack id="type" style={{ gap: '12px' }}>
        <h2 style={{ margin: 0 }}>Typography tokens</h2>
        <Stack style={{ gap: '8px' }}>
          {Object.entries(brand.tokens.type).map(([key, value]) => (
            <div key={key} style={{ fontSize: '0.875rem' }}>
              <code>{key}</code>: {value}
            </div>
          ))}
        </Stack>
      </Stack>
    </Stack>
  );
}

function ColorRow({ name, value }: { name: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.875rem' }}>
      <span
        style={{
          width: '24px',
          height: '24px',
          borderRadius: '4px',
          background: value,
          flexShrink: 0,
          border: '1px solid var(--color-neutral-200, #e5e7eb)',
        }}
      />
      <code>{name}</code>
      <span style={{ color: 'var(--color-neutral-500, #6b7280)' }}>{value}</span>
    </div>
  );
}

function DocsToc({ content }: { content: DocsTocContent }) {
  const entries = ['Overview', 'Voice', 'Color tokens', 'Typography'];
  return (
    <Box
      as="aside"
      style={{
        width: '200px',
        padding: '24px 16px',
        borderLeft: '1px solid var(--color-neutral-200, #e5e7eb)',
        flexShrink: 0,
      }}
    >
      <Stack style={{ gap: '12px' }}>
        <span style={{ fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--color-neutral-500, #6b7280)' }}>
          {content.heading}
        </span>
        <Stack style={{ gap: '4px' }}>
          {entries.map((e) => (
            <a
              key={e}
              href={`#${e.toLowerCase().replace(/\s+/g, '-')}`}
              style={{ fontSize: '0.8125rem', textDecoration: 'none', color: 'var(--color-neutral-700, #374151)' }}
            >
              {e}
            </a>
          ))}
        </Stack>
      </Stack>
    </Box>
  );
}
