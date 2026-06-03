// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import React from 'react';
import { Box, Stack, Grid, Card, CardHeader, CardTitle, CardContent, Separator, Badge } from '@booga/vui';
import type { VbrandType } from '../schema.js';
import type { CompositionSpec } from '../composition/spec.js';
import { visibleSections } from '../composition/spec.js';
import type { AppTypeTemplate, ContentOverrideMap } from './types.js';
import {
  deriveDashboardSidebarContent,
  deriveDashboardStatsContent,
  deriveDashboardGridContent,
} from './content-derivers.js';
import { applyContentOverride } from '../content/apply.js';

const SECTION_IDS = ['sidebar', 'stats', 'grid'] as const;
type DashboardSectionId = (typeof SECTION_IDS)[number];

type DashboardSidebarContent = ReturnType<typeof deriveDashboardSidebarContent>;
type DashboardStatsContent = ReturnType<typeof deriveDashboardStatsContent>;
type DashboardGridContent = ReturnType<typeof deriveDashboardGridContent>;

export const dashboardTemplate: AppTypeTemplate = {
  templateId: () => 'dashboard',

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
    const activeSections = visible.filter((s): s is typeof s & { id: DashboardSectionId } =>
      (SECTION_IDS as readonly string[]).includes(s.id),
    );

    const hasSidebar = activeSections.some((s) => s.id === 'sidebar');
    const hasStats = activeSections.some((s) => s.id === 'stats');
    const hasGrid = activeSections.some((s) => s.id === 'grid');

    const sidebarContent = applyContentOverride(deriveDashboardSidebarContent(brand), content, 'dashboard.sidebar');
    const statsContent = applyContentOverride(deriveDashboardStatsContent(brand), content, 'dashboard.stats');
    const gridContent = applyContentOverride(deriveDashboardGridContent(), content, 'dashboard.grid');

    return (
      <Box
        as="div"
        style={{ display: 'flex', minHeight: '100vh', fontFamily: `var(--type-body, system-ui)` }}
      >
        {hasSidebar && <DashboardSidebar content={sidebarContent} />}
        <Box as="main" style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {hasStats && <StatsRow content={statsContent} />}
          {hasGrid && <ContentGrid brand={brand} content={gridContent} />}
        </Box>
      </Box>
    );
  },
};

function DashboardSidebar({ content }: { content: DashboardSidebarContent }) {
  const navItems = [
    { label: 'Overview', active: true },
    { label: 'Brand tokens' },
    { label: 'Candidates' },
    { label: 'Emit history' },
    { label: 'Audit log' },
    { label: 'Settings' },
  ];

  return (
    <Box
      as="nav"
      style={{
        width: '220px',
        minHeight: '100vh',
        padding: '16px',
        borderRight: '1px solid var(--color-neutral-200, #e5e7eb)',
        background: 'var(--color-neutral-50, #f9fafb)',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-primary, #6366f1)', padding: '8px 4px' }}>
        {content.heading}
      </div>
      <Separator />
      <Stack style={{ gap: '4px' }}>
        {navItems.map((item) => (
          <div
            key={item.label}
            style={{
              padding: '8px 10px',
              borderRadius: '6px',
              fontSize: '0.875rem',
              cursor: 'pointer',
              background: item.active ? 'var(--color-primary, #6366f1)' : 'transparent',
              color: item.active ? 'white' : 'var(--color-neutral-700, #374151)',
            }}
          >
            {item.label}
          </div>
        ))}
      </Stack>
    </Box>
  );
}

function StatsRow({ content }: { content: DashboardStatsContent }) {
  return (
    <Stack style={{ gap: '12px' }}>
      <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{content.heading}</h2>
      <Grid columns={4} style={{ gap: '16px' }}>
        {content.stats.map((s) => (
          <Card key={s.label}>
            <CardHeader>
              <CardTitle style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--color-neutral-500, #6b7280)' }}>
                {s.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span style={{ fontSize: '1.5rem', fontWeight: 700 }}>{s.value}</span>
            </CardContent>
          </Card>
        ))}
      </Grid>
    </Stack>
  );
}

function ContentGrid({ brand, content }: { brand: VbrandType; content: DashboardGridContent }) {
  const colorEntries = Object.entries(brand.tokens.color).slice(0, 6);

  return (
    <Stack style={{ gap: '16px' }}>
      <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{content.heading}</h2>
      <Grid columns={3} style={{ gap: '16px' }}>
        {colorEntries.map(([key, value]) => (
          <Card key={key}>
            <CardContent style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  background: value,
                  flexShrink: 0,
                  border: '1px solid var(--color-neutral-200, #e5e7eb)',
                }}
              />
              <Stack>
                <span style={{ fontWeight: 500, fontSize: '0.875rem' }}>{key}</span>
                <code style={{ fontSize: '0.75rem', color: 'var(--color-neutral-500, #6b7280)' }}>{value}</code>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Grid>
      <Stack style={{ gap: '8px' }}>
        <h3 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600 }}>Voice</h3>
        <Card>
          <CardContent>
            <Stack style={{ gap: '8px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <Badge>canonical</Badge>
                <span style={{ fontSize: '0.875rem' }}>{brand.voice.canonical}</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <Badge>repo</Badge>
                <span style={{ fontSize: '0.875rem' }}>{brand.voice.repoDescription}</span>
              </div>
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Stack>
  );
}
