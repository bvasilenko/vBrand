// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { expect, test, type FrameLocator, type Page } from '@playwright/test';
import { FIXTURE_SLUGS } from '@booga/vfixtures';

const APPS = ['landing', 'marketing', 'docs', 'dashboard'];
const STACKS = ['vite', 'next', 'astro'];
const DEFAULT_MODE = { vite: 'SPA preview', next: 'hybrid', astro: 'static' } as const;

function normalizeText(value: string | null): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function compactText(value: string): string {
  return value.replace(/&quot;/g, '"').replace(/\s+/g, '');
}

async function previewText(page: Page, stack: string): Promise<string> {
  const frame = page.frameLocator(`iframe[data-stack-preview="${stack}"]`).first();
  return normalizeText(await frame.locator('main').first().textContent());
}

async function composedPreviewText(page: Page): Promise<string> {
  return normalizeText(await page.locator('[data-preview-content]').textContent());
}

async function stackPreviewFrame(page: Page, stack: string): Promise<FrameLocator> {
  const iframe = page.locator(`iframe[data-stack-preview="${stack}"]`);
  await expect(iframe).toBeVisible();
  await expect(iframe).toHaveAttribute('src', new RegExp(`/stacks/${stack}\\.html$`));
  return page.frameLocator(`iframe[data-stack-preview="${stack}"]`).first();
}

async function stackArtefactMeta(frame: FrameLocator) {
  const artefact = await frame.locator('#__VBRAND_STACK_ARTEFACT__').textContent();
  return JSON.parse(artefact ?? '{}') as { stack: string; version: string; artefact: string; shape: string };
}

test.describe('stack-axis probe', () => {
  for (const fixture of FIXTURE_SLUGS) {
    for (const app of APPS) {
      for (const stack of STACKS) {
        test(`${fixture}/${app}/${stack} preserves visible content and stack markers`, async ({ page }) => {
          const browserErrors: string[] = [];
          page.on('console', (message) => {
            if (message.type() === 'error') browserErrors.push(message.text());
          });
          page.on('pageerror', (error) => browserErrors.push(error.message));
          await page.goto(`/vBrand/?brand=fixture:${fixture}&app=${app}&stack=${stack}`);
          expect(new URL(page.url()).searchParams.get('stack')).toBe(stack);
          await expect(page.locator('[aria-label="Stack runtime axis"]')).toContainText(stack);
          const renderSurface = page.locator('[data-render-surface]').first();
          await expect(renderSurface).toHaveAttribute('data-render-surface', stack);
          await expect(renderSurface).toContainText(DEFAULT_MODE[stack as keyof typeof DEFAULT_MODE]);

          const stackText = await previewText(page, stack);
          expect(stackText.length).toBeGreaterThan(0);

          const frame = await stackPreviewFrame(page, stack);
          const meta = await stackArtefactMeta(frame);
          expect(meta.stack).toBe(stack);
          expect(meta.version).toMatch(/^\d+\.\d+\.\d+/);
          expect(meta.artefact).toBe(`dist/stacks/${stack}.html`);
          expect(meta.shape).toContain('not a live');
          const labelEl = frame.locator('[data-stack-preview-label]');
          await expect(labelEl).toBeVisible();
          await expect(labelEl).toContainText('not a live');

          if (stack === 'vite') {
            const payload = await frame.locator('#__VBRAND_STACK_PREVIEW__').textContent();
            const parsed = JSON.parse(payload ?? '{}') as { stack: string; textContent: string };
            expect(parsed.stack).toBe('vite');
            expect(compactText(parsed.textContent)).toBe(compactText(stackText));
            const bootstrap = await frame.locator('#__VBRAND_VITE_BOOTSTRAP_PREVIEW__').textContent();
            expect(JSON.parse(bootstrap ?? '{}')).toEqual({ boundary: 'spa-bootstrap-preview' });
            expect(browserErrors).toEqual([]);
            return;
          }

          if (stack === 'next') {
            const pageData = await frame.locator('#__NEXT_DATA__').textContent();
            const parsed = JSON.parse(pageData ?? '{}') as { props: { stack: string; textContent: string } };
            expect(parsed.props.stack).toBe('next');
            expect(compactText(parsed.props.textContent)).toBe(compactText(stackText));
          }
          if (stack === 'astro') {
            await expect(frame.locator('main[data-astro-static-shell="true"]')).toContainText(stackText.slice(0, 20));
            expect(await frame.locator('astro-island').count()).toBeGreaterThanOrEqual(1);
          }
          expect(browserErrors).toEqual([]);
        });
      }
    }
  }
});

test.describe('cross-stack text equivalence', () => {
  for (const fixture of FIXTURE_SLUGS) {
    for (const app of APPS) {
      test(`${fixture}/${app} renders equivalent composed content across all stacks`, async ({ page }) => {
        const texts: string[] = [];
        for (const stack of STACKS) {
          await page.goto(`/vBrand/?brand=fixture:${fixture}&app=${app}&stack=${stack}&mode=spa`);
          const text = await composedPreviewText(page);
          expect(text.length).toBeGreaterThan(0);
          texts.push(text);
        }
        for (const text of texts.slice(1)) {
          expect(text).toBe(texts[0]);
        }
      });
    }
  }
});

test.describe('stack-axis brand-fixture variation', () => {
  test('distinct brand fixtures render distinct composed content across every stack', async ({ page }) => {
    const [firstFixture, secondFixture] = FIXTURE_SLUGS;
    for (const stack of STACKS) {
      await page.goto(`/vBrand/?brand=fixture:${firstFixture}&app=landing&stack=${stack}&mode=spa`);
      const firstText = await composedPreviewText(page);

      await page.goto(`/vBrand/?brand=fixture:${secondFixture}&app=landing&stack=${stack}&mode=spa`);
      const secondText = await composedPreviewText(page);

      expect(firstText).not.toBe(secondText);
    }
  });
});
