// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ContentEditor } from '../src/content-editor.js';

vi.mock('@booga/vbrand/content', () => ({
  OVERRIDABLE_FIELDS: {
    landing: [
      { key: 'landing.hero.heading', label: 'Hero heading',    defaultValue: () => 'Placeholder heading', kind: 'text' },
      { key: 'landing.hero.items',   label: 'Hero list items', defaultValue: () => 'item-a, item-b',      kind: 'list' },
    ],
    marketing: [
      { key: 'marketing.intro.heading', label: 'Intro heading', defaultValue: () => 'Mktg placeholder', kind: 'text' },
    ],
    docs:      [],
    dashboard: [],
  },
}));

const FAKE_BRAND = {} as never;

const LANDING_TEXT_KEY = 'landing.hero.heading';
const LANDING_LIST_KEY = 'landing.hero.items';

let container: HTMLDivElement;
let root: Root;
let onChangeMock: ReturnType<typeof vi.fn>;
let onResetMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  onChangeMock = vi.fn();
  onResetMock = vi.fn();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

type Content = Record<string, string | string[]>;

function renderEditor(content: Content = {}, templateId = 'landing'): void {
  act(() => {
    root.render(
      React.createElement(ContentEditor, {
        brand: FAKE_BRAND,
        templateId: templateId as never,
        content: content as never,
        onChange: onChangeMock,
        onReset: onResetMock,
      }),
    );
  });
}

function allTextInputs(): HTMLInputElement[] {
  return [...container.querySelectorAll('input[type="text"]') ] as HTMLInputElement[];
}

function allTextareas(): HTMLTextAreaElement[] {
  return [...container.querySelectorAll('textarea')] as HTMLTextAreaElement[];
}

function allLabels(): string[] {
  return [...container.querySelectorAll('label')].map((l) => l.textContent?.trim() ?? '');
}

function resetButton(): HTMLButtonElement {
  return container.querySelector('button') as HTMLButtonElement;
}

function simulateInputChange(el: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
  act(() => {
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function simulateTextareaChange(el: HTMLTextAreaElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')!.set!;
  act(() => {
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}


describe('ContentEditor: field rendering per templateId', () => {
  it('landing template: renders one text input and one textarea', () => {
    renderEditor({}, 'landing');
    expect(allTextInputs()).toHaveLength(1);
    expect(allTextareas()).toHaveLength(1);
  });

  it('marketing template: renders one text input and no textarea', () => {
    renderEditor({}, 'marketing');
    expect(allTextInputs()).toHaveLength(1);
    expect(allTextareas()).toHaveLength(0);
  });

  it('template with no registered fields renders no inputs', () => {
    renderEditor({}, 'docs');
    expect(allTextInputs()).toHaveLength(0);
    expect(allTextareas()).toHaveLength(0);
  });

  it('field labels match the OVERRIDABLE_FIELDS label property', () => {
    renderEditor({}, 'landing');
    expect(allLabels()).toContain('Hero heading');
    expect(allLabels()).toContain('Hero list items');
  });

  it('switching templateId changes the rendered fields', () => {
    renderEditor({}, 'landing');
    const landingCount = allTextInputs().length + allTextareas().length;
    renderEditor({}, 'marketing');
    const marketingCount = allTextInputs().length + allTextareas().length;
    expect(landingCount).not.toBe(marketingCount);
  });
});


describe('ContentEditor: initial input values', () => {
  it('text input shows empty string when currentValue is undefined (no override)', () => {
    renderEditor({});
    expect(allTextInputs()[0]!.value).toBe('');
  });

  it('text input shows the override string when currentValue is a string', () => {
    renderEditor({ [LANDING_TEXT_KEY]: 'Custom heading' });
    expect(allTextInputs()[0]!.value).toBe('Custom heading');
  });

  it('textarea shows empty string when currentValue is undefined', () => {
    renderEditor({});
    expect(allTextareas()[0]!.value).toBe('');
  });

  it('textarea shows newline-joined string when currentValue is a string array', () => {
    renderEditor({ [LANDING_LIST_KEY]: ['first', 'second', 'third'] });
    expect(allTextareas()[0]!.value).toBe('first\nsecond\nthird');
  });

  it('text input placeholder reflects the field defaultValue', () => {
    renderEditor({});
    expect(allTextInputs()[0]!.placeholder).toBe('Placeholder heading');
  });

  it('textarea placeholder reflects the field defaultValue', () => {
    renderEditor({});
    expect(allTextareas()[0]!.placeholder).toBe('item-a, item-b');
  });
});


describe('ContentEditor: controlled input value tracks currentValue prop across re-renders', () => {
  it('text input clears when currentValue changes from string to undefined', () => {
    renderEditor({ [LANDING_TEXT_KEY]: 'Previous value' });
    expect(allTextInputs()[0]!.value).toBe('Previous value');

    renderEditor({});
    expect(allTextInputs()[0]!.value).toBe('');
  });

  it('text input updates when currentValue changes from undefined to a string', () => {
    renderEditor({});
    expect(allTextInputs()[0]!.value).toBe('');

    renderEditor({ [LANDING_TEXT_KEY]: 'New value' });
    expect(allTextInputs()[0]!.value).toBe('New value');
  });

  it('text input updates when currentValue changes from one string to another', () => {
    renderEditor({ [LANDING_TEXT_KEY]: 'First' });
    renderEditor({ [LANDING_TEXT_KEY]: 'Second' });
    expect(allTextInputs()[0]!.value).toBe('Second');
  });

  it('textarea clears when currentValue changes from string[] to undefined', () => {
    renderEditor({ [LANDING_LIST_KEY]: ['a', 'b'] });
    expect(allTextareas()[0]!.value).toBe('a\nb');

    renderEditor({});
    expect(allTextareas()[0]!.value).toBe('');
  });

  it('textarea updates when currentValue changes from undefined to string[]', () => {
    renderEditor({});
    expect(allTextareas()[0]!.value).toBe('');

    renderEditor({ [LANDING_LIST_KEY]: ['x', 'y'] });
    expect(allTextareas()[0]!.value).toBe('x\ny');
  });

  it('textarea reflects a new string[] value after a prior string[] value', () => {
    renderEditor({ [LANDING_LIST_KEY]: ['old'] });
    renderEditor({ [LANDING_LIST_KEY]: ['new-a', 'new-b'] });
    expect(allTextareas()[0]!.value).toBe('new-a\nnew-b');
  });

  it('list clear does not affect the text field value', () => {
    renderEditor({ [LANDING_TEXT_KEY]: 'Heading', [LANDING_LIST_KEY]: ['item'] });
    renderEditor({ [LANDING_TEXT_KEY]: 'Heading' });
    expect(allTextInputs()[0]!.value).toBe('Heading');
    expect(allTextareas()[0]!.value).toBe('');
  });

  it('text clear does not affect the list field value', () => {
    renderEditor({ [LANDING_TEXT_KEY]: 'Heading', [LANDING_LIST_KEY]: ['item'] });
    renderEditor({ [LANDING_LIST_KEY]: ['item'] });
    expect(allTextInputs()[0]!.value).toBe('');
    expect(allTextareas()[0]!.value).toBe('item');
  });
});


describe('ContentEditor: onChange debounce and type routing', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('text field: onChange is not called before the debounce period elapses', () => {
    renderEditor({});
    simulateInputChange(allTextInputs()[0]!, 'Typed');
    expect(onChangeMock).not.toHaveBeenCalled();
  });

  it('text field: onChange is called with the typed string after debounce', () => {
    renderEditor({});
    simulateInputChange(allTextInputs()[0]!, 'Custom text');
    act(() => vi.runAllTimers());
    expect(onChangeMock).toHaveBeenCalledTimes(1);
    const [map] = onChangeMock.mock.calls[0] as [Record<string, unknown>];
    expect(map[LANDING_TEXT_KEY]).toBe('Custom text');
  });

  it('text field: clearing the input calls onChange with a map that omits the field key', () => {
    renderEditor({ [LANDING_TEXT_KEY]: 'Existing' });
    simulateInputChange(allTextInputs()[0]!, '');
    act(() => vi.runAllTimers());
    expect(onChangeMock).toHaveBeenCalledTimes(1);
    const [map] = onChangeMock.mock.calls[0] as [Record<string, unknown>];
    expect(Object.prototype.hasOwnProperty.call(map, LANDING_TEXT_KEY)).toBe(false);
  });

  it('list field: onChange is called with a string[] after debounce', () => {
    renderEditor({});
    simulateTextareaChange(allTextareas()[0]!, 'line-one\nline-two\nline-three');
    act(() => vi.runAllTimers());
    expect(onChangeMock).toHaveBeenCalledTimes(1);
    const [map] = onChangeMock.mock.calls[0] as [Record<string, unknown>];
    expect(map[LANDING_LIST_KEY]).toEqual(['line-one', 'line-two', 'line-three']);
  });

  it('list field: empty lines are filtered from the resulting string[]', () => {
    renderEditor({});
    simulateTextareaChange(allTextareas()[0]!, 'a\n\nb\n');
    act(() => vi.runAllTimers());
    expect(onChangeMock).toHaveBeenCalledTimes(1);
    const [map] = onChangeMock.mock.calls[0] as [Record<string, unknown>];
    expect(map[LANDING_LIST_KEY]).toEqual(['a', 'b']);
  });

  it('multiple rapid changes before debounce produce exactly one onChange call', () => {
    renderEditor({});
    const input = allTextInputs()[0]!;
    simulateInputChange(input, 'a');
    simulateInputChange(input, 'ab');
    simulateInputChange(input, 'abc');
    act(() => vi.runAllTimers());
    expect(onChangeMock).toHaveBeenCalledTimes(1);
    const [map] = onChangeMock.mock.calls[0] as [Record<string, unknown>];
    expect(map[LANDING_TEXT_KEY]).toBe('abc');
  });
});


describe('ContentEditor: Reset button', () => {
  it('clicking Reset calls onReset exactly once', () => {
    renderEditor({});
    act(() => resetButton().click());
    expect(onResetMock).toHaveBeenCalledTimes(1);
  });

  it('clicking Reset multiple times calls onReset that many times', () => {
    renderEditor({});
    act(() => resetButton().click());
    act(() => resetButton().click());
    act(() => resetButton().click());
    expect(onResetMock).toHaveBeenCalledTimes(3);
  });

  it('Reset button does not call onChange', () => {
    renderEditor({});
    act(() => resetButton().click());
    expect(onChangeMock).not.toHaveBeenCalled();
  });
});
