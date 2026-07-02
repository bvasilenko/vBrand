// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DeployInfo } from '../src/deploy-info.js';
import { DEPLOY_TARGET_METADATA, DEFAULT_DEPLOY_TARGET } from '@booga/vbrand/deploy/metadata';

const DEFERRED_TARGETS = DEPLOY_TARGET_METADATA.filter((target) => target.name !== DEFAULT_DEPLOY_TARGET);
const HOSTED_URL = 'https://bvasilenko.github.io/vBrand/';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root.render(React.createElement(DeployInfo, null)); });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function text(): string {
  return container.textContent ?? '';
}

describe('DeployInfo - heading and section label', () => {
  it('renders the "Deploy target" section heading', () => {
    expect(text().toLowerCase()).toContain('deploy target');
  });

  it('renders an aside with the aria-label for the deployment contract', () => {
    const aside = container.querySelector('aside');
    expect(aside?.getAttribute('aria-label')).toBe('Deployment target contract');
  });
});

describe('DeployInfo - complete target list from registry', () => {
  it('renders exactly as many list items as there are registered deploy targets', () => {
    const items = container.querySelectorAll('li');
    expect(items).toHaveLength(DEPLOY_TARGET_METADATA.length);
  });

  it.each(DEPLOY_TARGET_METADATA)('renders the target identifier "$name" in the list', (target) => {
    expect(text()).toContain(target.name);
    expect(text()).toContain(target.label);
    expect(text()).toContain(target.badge);
  });
});

describe('DeployInfo - wired target: gh-pages', () => {
  it('marks the default deploy target as the wired implementation via "index.html" badge', () => {
    expect(text()).toContain('index.html');
  });

  it('does not mark the default deploy target as DECOUPLED-FOR-LATER', () => {
    const items = Array.from(container.querySelectorAll('li'));
    const wiredItem = items.find((li) => li.textContent?.includes(DEFAULT_DEPLOY_TARGET));
    expect(wiredItem?.textContent).not.toContain('DECOUPLED-FOR-LATER');
  });
});

describe('DeployInfo - deferred targets', () => {
  it.each(DEFERRED_TARGETS)('marks "$name" as DECOUPLED-FOR-LATER', (target) => {
    const items = Array.from(container.querySelectorAll('li'));
    const item = items.find((li) => li.textContent?.includes(target.name));
    expect(item?.textContent).toContain('DECOUPLED-FOR-LATER');
  });

  it('shows exactly one "index.html" badge (only the wired target gets it)', () => {
    const items = Array.from(container.querySelectorAll('li'));
    const wiredItems = items.filter((li) => li.textContent?.includes('index.html'));
    expect(wiredItems).toHaveLength(1);
  });
});

describe('DeployInfo - live surface link', () => {
  it('renders a link to the hosted demo URL', () => {
    const anchor = container.querySelector(`a[href="${HOSTED_URL}"]`);
    expect(anchor).not.toBeNull();
  });

  it('the live link text matches the hosted URL', () => {
    const anchor = container.querySelector(`a[href="${HOSTED_URL}"]`);
    expect(anchor?.textContent).toContain(HOSTED_URL);
  });
});

describe('DeployInfo - deploy manifest label', () => {
  it('renders the "deploy manifest" eyebrow label', () => {
    expect(text().toLowerCase()).toContain('deploy manifest');
  });
});
