// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useComposition } from '../src/use-composition.js';
import type { UseCompositionResult } from '../src/use-composition.js';
import type { TemplateId } from '../src/router.js';

let mockCompositionFromHash: (hash: string) => unknown = () => null;
let mockCompositionMatchesTemplate: (comp: unknown, id: string) => boolean = () => false;
let mockContentFromHash: (hash: string) => unknown = () => null;

vi.mock('@booga/vbrand/composition', () => ({
  compositionFromHash: (hash: string) => mockCompositionFromHash(hash),
  encodeComposition: (c: unknown) => JSON.stringify(c),
}));

const TEMPLATE_COMPOSITIONS: Record<TemplateId, object> = {
  landing:   { sections: [{ id: 'hero',     visible: true, density: 'regular' as const, order: 0 }] },
  marketing: { sections: [{ id: 'features', visible: true, density: 'regular' as const, order: 0 }] },
  docs:      { sections: [{ id: 'article',  visible: true, density: 'regular' as const, order: 0 }] },
  dashboard: { sections: [{ id: 'metrics',  visible: true, density: 'regular' as const, order: 0 }] },
};

vi.mock('@booga/vbrand/templates', () => ({
  TEMPLATE_REGISTRY: {
    landing:   { defaultComposition: () => ({ ...TEMPLATE_COMPOSITIONS.landing }),   compose: () => null },
    marketing: { defaultComposition: () => ({ ...TEMPLATE_COMPOSITIONS.marketing }), compose: () => null },
    docs:      { defaultComposition: () => ({ ...TEMPLATE_COMPOSITIONS.docs }),      compose: () => null },
    dashboard: { defaultComposition: () => ({ ...TEMPLATE_COMPOSITIONS.dashboard }), compose: () => null },
  },
  compositionMatchesTemplate: (comp: unknown, id: string) => mockCompositionMatchesTemplate(comp, id),
}));

vi.mock('@booga/vbrand/content', () => ({
  contentFromHash: (hash: string) => mockContentFromHash(hash),
  contentToHash: (_c: unknown) => 'content=mock',
}));

interface ProbeProps { templateId: TemplateId }

let capturedResult: UseCompositionResult | null = null;

function Probe({ templateId }: ProbeProps): React.ReactElement {
  capturedResult = useComposition(templateId);
  return React.createElement('div', { 'data-probe': 'true' });
}

const ALL_TEMPLATE_IDS: readonly TemplateId[] = ['landing', 'marketing', 'docs', 'dashboard'];

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  capturedResult = null;
  mockCompositionFromHash = () => null;
  mockCompositionMatchesTemplate = () => false;
  mockContentFromHash = () => null;
  Object.defineProperty(window, 'location', {
    value: { hash: '', search: '?app=landing', pathname: '/' },
    writable: true,
    configurable: true,
  });
  vi.spyOn(history, 'replaceState');
});

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
  vi.restoreAllMocks();
});

function renderProbe(templateId: TemplateId): void {
  act(() => { root.render(React.createElement(Probe, { templateId })); });
}

describe('useComposition - initial state: template defaults', () => {
  it.each(ALL_TEMPLATE_IDS)(
    'initializes composition from template default for templateId "%s" when hash has no composition',
    (templateId) => {
      renderProbe(templateId);
      expect(capturedResult?.composition).toEqual(TEMPLATE_COMPOSITIONS[templateId]);
    },
  );

  it('initializes userContent as empty object when contentFromHash returns null', () => {
    mockContentFromHash = () => null;
    renderProbe('landing');
    expect(capturedResult?.userContent).toEqual({});
  });
});

describe('useComposition - initial state: hash initialization', () => {
  it('uses composition from hash when compositionFromHash returns a value matching the template', () => {
    const hashComposition = { sections: [{ id: 'from-hash', visible: true, density: 'compact' as const, order: 0 }] };
    mockCompositionFromHash = () => hashComposition;
    mockCompositionMatchesTemplate = () => true;
    renderProbe('landing');
    expect(capturedResult?.composition).toEqual(hashComposition);
  });

  it('falls back to template default when compositionFromHash returns a non-null value not matching the template', () => {
    const staleComposition = { sections: [{ id: 'stale', visible: false, density: 'regular' as const, order: 0 }] };
    mockCompositionFromHash = () => staleComposition;
    mockCompositionMatchesTemplate = () => false;
    renderProbe('landing');
    expect(capturedResult?.composition).toEqual(TEMPLATE_COMPOSITIONS.landing);
  });

  it('falls back to template default when compositionFromHash returns null', () => {
    mockCompositionFromHash = () => null;
    renderProbe('landing');
    expect(capturedResult?.composition).toEqual(TEMPLATE_COMPOSITIONS.landing);
  });

  it('uses initial content from contentFromHash when it returns a non-null value', () => {
    const hashContent = { 'landing.hero.heading': 'from-hash-content' };
    mockContentFromHash = () => hashContent;
    renderProbe('landing');
    expect(capturedResult?.userContent).toEqual(hashContent);
  });

  it.each(ALL_TEMPLATE_IDS)(
    'compositionMatchesTemplate receives the correct templateId "%s" for template-match gating',
    (templateId) => {
      const hashComposition = { sections: [] };
      mockCompositionFromHash = () => hashComposition;
      const seenIds: string[] = [];
      mockCompositionMatchesTemplate = (_comp, id) => { seenIds.push(id); return false; };
      renderProbe(templateId);
      expect(seenIds).toContain(templateId);
    },
  );

  it.each(ALL_TEMPLATE_IDS)(
    'adopts hash composition (match=true) and ignores template default for templateId "%s"',
    (templateId) => {
      const hashComposition = { sections: [{ id: `hash-${templateId}`, visible: true, density: 'regular' as const, order: 0 }] };
      mockCompositionFromHash = () => hashComposition;
      mockCompositionMatchesTemplate = () => true;
      renderProbe(templateId);
      expect(capturedResult?.composition).toEqual(hashComposition);
      expect(capturedResult?.composition).not.toEqual(TEMPLATE_COMPOSITIONS[templateId]);
    },
  );
});

describe('useComposition - setComposition', () => {
  it('updates composition when setComposition is called with a direct value', () => {
    renderProbe('landing');
    const updated = { sections: [{ id: 'cta', visible: true, density: 'compact' as const, order: 1 }] };
    act(() => { capturedResult?.setComposition(updated); });
    expect(capturedResult?.composition).toEqual(updated);
  });

  it('supports functional updater form for setComposition', () => {
    renderProbe('landing');
    const originalLength = capturedResult?.composition.sections.length ?? 0;
    act(() => {
      capturedResult?.setComposition((prev) => ({
        ...prev,
        sections: [...prev.sections, { id: 'appended', visible: false, density: 'regular' as const, order: 99 }],
      }));
    });
    expect(capturedResult?.composition.sections).toHaveLength(originalLength + 1);
    expect(capturedResult?.composition.sections.at(-1)?.id).toBe('appended');
  });

  it('accepts an empty sections array without error', () => {
    renderProbe('landing');
    act(() => { capturedResult?.setComposition({ sections: [] }); });
    expect(capturedResult?.composition).toEqual({ sections: [] });
  });

  it('subsequent setComposition calls each take effect independently', () => {
    renderProbe('landing');
    const first  = { sections: [{ id: 'first',  visible: true,  density: 'regular' as const, order: 0 }] };
    const second = { sections: [{ id: 'second', visible: false, density: 'compact' as const, order: 1 }] };
    act(() => { capturedResult?.setComposition(first); });
    expect(capturedResult?.composition).toEqual(first);
    act(() => { capturedResult?.setComposition(second); });
    expect(capturedResult?.composition).toEqual(second);
  });
});

describe('useComposition - setUserContent', () => {
  it('updates userContent when setUserContent is called', () => {
    renderProbe('landing');
    act(() => { capturedResult?.setUserContent({ 'landing.hero.heading': 'custom' }); });
    expect(capturedResult?.userContent).toEqual({ 'landing.hero.heading': 'custom' });
  });

  it('replacing userContent entirely discards previously set keys', () => {
    renderProbe('landing');
    act(() => { capturedResult?.setUserContent({ 'landing.hero.heading': 'first' }); });
    act(() => { capturedResult?.setUserContent({ 'landing.hero.cta': 'second' }); });
    expect(capturedResult?.userContent).not.toHaveProperty('landing.hero.heading');
    expect(capturedResult?.userContent).toHaveProperty('landing.hero.cta', 'second');
  });

  it('setting userContent to an empty object is equivalent to clearing it', () => {
    renderProbe('landing');
    act(() => { capturedResult?.setUserContent({ 'landing.hero.heading': 'set' }); });
    act(() => { capturedResult?.setUserContent({}); });
    expect(capturedResult?.userContent).toEqual({});
  });
});

describe('useComposition - handleReset', () => {
  it.each(ALL_TEMPLATE_IDS)(
    'handleReset restores the correct defaultComposition for templateId "%s"',
    (templateId) => {
      renderProbe(templateId);
      act(() => { capturedResult?.setComposition({ sections: [] }); });
      act(() => { capturedResult?.handleReset(); });
      expect(capturedResult?.composition).toEqual(TEMPLATE_COMPOSITIONS[templateId]);
    },
  );

  it('handleReset clears userContent to an empty object', () => {
    renderProbe('landing');
    act(() => { capturedResult?.setUserContent({ 'landing.hero.heading': 'custom' }); });
    act(() => { capturedResult?.handleReset(); });
    expect(capturedResult?.userContent).toEqual({});
  });

  it('handleReset resets both composition and userContent simultaneously', () => {
    renderProbe('landing');
    act(() => { capturedResult?.setUserContent({ 'landing.hero.heading': 'custom' }); });
    act(() => { capturedResult?.setComposition({ sections: [] }); });
    act(() => { capturedResult?.handleReset(); });
    expect(capturedResult?.composition).toEqual(TEMPLATE_COMPOSITIONS.landing);
    expect(capturedResult?.userContent).toEqual({});
  });

  it('double handleReset is idempotent', () => {
    renderProbe('landing');
    act(() => { capturedResult?.setComposition({ sections: [] }); });
    act(() => { capturedResult?.handleReset(); });
    act(() => { capturedResult?.handleReset(); });
    expect(capturedResult?.composition).toEqual(TEMPLATE_COMPOSITIONS.landing);
    expect(capturedResult?.userContent).toEqual({});
  });
});

describe('useComposition - templateId change', () => {
  it('resets composition to the new template default when templateId changes', () => {
    renderProbe('landing');
    act(() => { root.render(React.createElement(Probe, { templateId: 'marketing' })); });
    expect(capturedResult?.composition).toEqual(TEMPLATE_COMPOSITIONS.marketing);
  });

  it('clears userContent when templateId changes', () => {
    renderProbe('landing');
    act(() => { capturedResult?.setUserContent({ 'landing.hero.heading': 'custom' }); });
    act(() => { root.render(React.createElement(Probe, { templateId: 'marketing' })); });
    expect(capturedResult?.userContent).toEqual({});
  });

  it('does not reset composition when re-rendered with the same templateId', () => {
    renderProbe('landing');
    const custom = { sections: [{ id: 'custom', visible: true, density: 'compact' as const, order: 0 }] };
    act(() => { capturedResult?.setComposition(custom); });
    act(() => { root.render(React.createElement(Probe, { templateId: 'landing' })); });
    expect(capturedResult?.composition).toEqual(custom);
  });

  it('does not clear userContent when re-rendered with the same templateId', () => {
    renderProbe('landing');
    act(() => { capturedResult?.setUserContent({ 'landing.hero.heading': 'persisted' }); });
    act(() => { root.render(React.createElement(Probe, { templateId: 'landing' })); });
    expect(capturedResult?.userContent).toEqual({ 'landing.hero.heading': 'persisted' });
  });

  it('handles three sequential templateId changes and always applies the latest template default', () => {
    renderProbe('landing');
    act(() => { root.render(React.createElement(Probe, { templateId: 'marketing' })); });
    expect(capturedResult?.composition).toEqual(TEMPLATE_COMPOSITIONS.marketing);
    act(() => { root.render(React.createElement(Probe, { templateId: 'docs' })); });
    expect(capturedResult?.composition).toEqual(TEMPLATE_COMPOSITIONS.docs);
    act(() => { root.render(React.createElement(Probe, { templateId: 'landing' })); });
    expect(capturedResult?.composition).toEqual(TEMPLATE_COMPOSITIONS.landing);
  });

  it('userContent is cleared on each templateId change in a sequence', () => {
    renderProbe('landing');
    act(() => { capturedResult?.setUserContent({ 'landing.hero.heading': 'step1' }); });
    act(() => { root.render(React.createElement(Probe, { templateId: 'marketing' })); });
    expect(capturedResult?.userContent).toEqual({});
    act(() => { capturedResult?.setUserContent({ 'marketing.intro.heading': 'step2' }); });
    act(() => { root.render(React.createElement(Probe, { templateId: 'docs' })); });
    expect(capturedResult?.userContent).toEqual({});
  });

  it('templateId-change guard is the ref sentinel, not compositionMatchesTemplate alone', () => {
    renderProbe('landing');
    const custom = { sections: [{ id: 'kept', visible: true, density: 'regular' as const, order: 0 }] };
    act(() => { capturedResult?.setComposition(custom); });
    mockCompositionMatchesTemplate = () => true;
    act(() => { root.render(React.createElement(Probe, { templateId: 'landing' })); });
    expect(capturedResult?.composition).toEqual(custom);
  });
});

describe('useComposition - URL sync (history.replaceState)', () => {
  it('calls history.replaceState on initial render with a hash containing the encoded composition', () => {
    renderProbe('landing');
    const encodedComp = JSON.stringify(TEMPLATE_COMPOSITIONS.landing);
    expect(history.replaceState).toHaveBeenCalledWith(
      null, '',
      expect.stringContaining(`#composition=${encodedComp}`),
    );
  });

  it.each(ALL_TEMPLATE_IDS)(
    'replaceState encodes the correct default composition for templateId "%s"',
    (templateId) => {
      renderProbe(templateId);
      const encodedComp = JSON.stringify(TEMPLATE_COMPOSITIONS[templateId]);
      expect(history.replaceState).toHaveBeenCalledWith(
        null, '',
        expect.stringContaining(`#composition=${encodedComp}`),
      );
    },
  );

  it('calls history.replaceState again when composition changes', () => {
    renderProbe('landing');
    vi.mocked(history.replaceState).mockClear();
    const updated = { sections: [{ id: 'new', visible: true, density: 'regular' as const, order: 0 }] };
    act(() => { capturedResult?.setComposition(updated); });
    const lastUrl = String(vi.mocked(history.replaceState).mock.calls.at(-1)?.[2] ?? '');
    expect(lastUrl).toContain(`#composition=${JSON.stringify(updated)}`);
  });

  it('hash excludes the content part when userContent is empty', () => {
    renderProbe('landing');
    const lastUrl = String(vi.mocked(history.replaceState).mock.calls.at(-1)?.[2] ?? '');
    expect(lastUrl).toContain('#composition=');
    expect(lastUrl).not.toContain('content=mock');
  });

  it('hash includes the content part when userContent is non-empty', () => {
    renderProbe('landing');
    vi.mocked(history.replaceState).mockClear();
    act(() => { capturedResult?.setUserContent({ 'landing.hero.heading': 'custom' }); });
    const lastUrl = String(vi.mocked(history.replaceState).mock.calls.at(-1)?.[2] ?? '');
    expect(lastUrl).toContain('#composition=');
    expect(lastUrl).toContain('content=mock');
  });

  it('replaceState URL contains window.location.pathname and search', () => {
    renderProbe('landing');
    const lastUrl = String(vi.mocked(history.replaceState).mock.calls.at(-1)?.[2] ?? '');
    expect(lastUrl).toContain('/');
    expect(lastUrl).toContain('?app=landing');
  });

  it('replaceState is called when userContent changes from non-empty to empty', () => {
    renderProbe('landing');
    act(() => { capturedResult?.setUserContent({ 'landing.hero.heading': 'set' }); });
    vi.mocked(history.replaceState).mockClear();
    act(() => { capturedResult?.setUserContent({}); });
    const lastUrl = String(vi.mocked(history.replaceState).mock.calls.at(-1)?.[2] ?? '');
    expect(lastUrl).not.toContain('content=mock');
  });
});
