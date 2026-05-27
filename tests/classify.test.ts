import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runClassify } from '../src/commands/classify.js';
import { ClassifiedNode, classifyHtml } from '../src/lib/html.js';

const FIXTURES_DIR = join(import.meta.dirname, 'fixtures');
const SAMPLE_HTML_PATH = join(FIXTURES_DIR, 'sample.html');

function findAll(nodes: ClassifiedNode[], predicate: (n: ClassifiedNode) => boolean): ClassifiedNode[] {
  const results: ClassifiedNode[] = [];
  for (const node of nodes) {
    if (predicate(node)) results.push(node);
    results.push(...findAll(node.children, predicate));
  }
  return results;
}

function findFirst(nodes: ClassifiedNode[], predicate: (n: ClassifiedNode) => boolean): ClassifiedNode | undefined {
  for (const node of nodes) {
    if (predicate(node)) return node;
    const found = findFirst(node.children, predicate);
    if (found) return found;
  }
  return undefined;
}

describe('classifyHtml - purity', () => {
  it('identical input yields identical JSON output across multiple calls', () => {
    const html = readFileSync(SAMPLE_HTML_PATH, 'utf-8');
    const runs = Array.from({ length: 3 }, () => JSON.stringify(classifyHtml(SAMPLE_HTML_PATH, html)));
    expect(runs[0]).toBe(runs[1]);
    expect(runs[1]).toBe(runs[2]);
  });

  it('preserves sourcePath argument verbatim in the report', () => {
    const path = '/some/arbitrary/page.html';
    const report = classifyHtml(path, '<html><body><p>x</p></body></html>');
    expect(report.sourcePath).toBe(path);
  });
});

describe('classifyHtml - heading hierarchy', () => {
  it.each([1, 2, 3, 4, 5, 6])('h%i → heading role with level %i', (level) => {
    const html = `<html><body><h${level}>Title</h${level}></body></html>`;
    const report = classifyHtml('t.html', html);
    const heading = findFirst(report.nodes, (n) => n.tagName === `h${level}`);
    expect(heading?.role).toBe('heading');
    expect(heading?.level).toBe(level);
  });

  it('extracts text content from heading', () => {
    const report = classifyHtml('t.html', '<html><body><h1>Welcome</h1></body></html>');
    const h1 = findFirst(report.nodes, (n) => n.tagName === 'h1');
    expect(h1?.text).toBe('Welcome');
  });

  it('summary.headingCount counts all headings at any nesting depth', () => {
    const html = '<html><body><h1>A</h1><section><h2>B</h2><article><h3>C</h3></article></section></body></html>';
    const report = classifyHtml('t.html', html);
    expect(report.summary.headingCount).toBe(3);
  });
});

describe('classifyHtml - navigation and landmarks', () => {
  it('nav → navigation role', () => {
    const report = classifyHtml('t.html', '<html><body><nav><a href="/">Home</a></nav></body></html>');
    const nav = findFirst(report.nodes, (n) => n.tagName === 'nav');
    expect(nav?.role).toBe('navigation');
  });

  it('summary.navigationCount counts all nav elements at any depth', () => {
    const html = '<html><body><nav>A</nav><footer><nav>B</nav></footer></body></html>';
    const report = classifyHtml('t.html', html);
    expect(report.summary.navigationCount).toBe(2);
  });

  it('nav inside header is counted in both summary.navigationCount and landmarks', () => {
    const html = '<html><body><header><nav>X</nav></header></body></html>';
    const report = classifyHtml('t.html', html);
    expect(report.summary.navigationCount).toBe(1);
    expect(report.summary.landmarks).toContain('nav');
    expect(report.summary.landmarks).toContain('header');
  });

  it.each(['header', 'footer', 'main', 'article', 'aside', 'section'] as const)(
    '%s → its named role and appears in landmarks',
    (tag) => {
      const html = `<html><body><${tag}>content</${tag}></body></html>`;
      const report = classifyHtml('t.html', html);
      expect(report.summary.landmarks).toContain(tag);
    },
  );

  it('landmarks list is sorted alphabetically', () => {
    const html = '<html><body><nav/><header/><footer/><main/></body></html>';
    const report = classifyHtml('t.html', html);
    expect(report.summary.landmarks).toEqual([...report.summary.landmarks].sort());
  });
});

describe('classifyHtml - inline and interactive roles', () => {
  it('p → paragraph role with text content', () => {
    const report = classifyHtml('t.html', '<html><body><p>Hello world</p></body></html>');
    const para = findFirst(report.nodes, (n) => n.tagName === 'p');
    expect(para?.role).toBe('paragraph');
    expect(para?.text).toContain('Hello world');
  });

  it('a → link role with href preserved in attributes', () => {
    const report = classifyHtml('t.html', '<html><body><a href="/about">About</a></body></html>');
    const link = findFirst(report.nodes, (n) => n.tagName === 'a');
    expect(link?.role).toBe('link');
    expect(link?.attributes?.['href']).toBe('/about');
  });

  it('ul → list role', () => {
    const report = classifyHtml('t.html', '<html><body><ul><li>A</li></ul></body></html>');
    const list = findFirst(report.nodes, (n) => n.tagName === 'ul');
    expect(list?.role).toBe('list');
  });

  it('ol → list role', () => {
    const report = classifyHtml('t.html', '<html><body><ol><li>A</li></ol></body></html>');
    const list = findFirst(report.nodes, (n) => n.tagName === 'ol');
    expect(list?.role).toBe('list');
  });

  it('li → list-item role', () => {
    const report = classifyHtml('t.html', '<html><body><ul><li>Item</li></ul></body></html>');
    const item = findFirst(report.nodes, (n) => n.tagName === 'li');
    expect(item?.role).toBe('list-item');
  });

  it('button → button role', () => {
    const report = classifyHtml('t.html', '<html><body><button type="submit">Go</button></body></html>');
    const btn = findFirst(report.nodes, (n) => n.tagName === 'button');
    expect(btn?.role).toBe('button');
  });

  it('form → form role', () => {
    const report = classifyHtml('t.html', '<html><body><form action="/"><input/></form></body></html>');
    const form = findFirst(report.nodes, (n) => n.tagName === 'form');
    expect(form?.role).toBe('form');
  });

  it('img → image role', () => {
    const report = classifyHtml('t.html', '<html><body><img src="logo.png" alt="Logo"/></body></html>');
    const img = findFirst(report.nodes, (n) => n.tagName === 'img');
    expect(img?.role).toBe('image');
    expect(img?.attributes?.['src']).toBe('logo.png');
    expect(img?.attributes?.['alt']).toBe('Logo');
  });

  it('div and span → unknown role', () => {
    const report = classifyHtml('t.html', '<html><body><div><span>text</span></div></body></html>');
    const div = findFirst(report.nodes, (n) => n.tagName === 'div');
    expect(div?.role).toBe('unknown');
    const span = findFirst(report.nodes, (n) => n.tagName === 'span');
    expect(span?.role).toBe('unknown');
  });

  it('class attribute is not preserved in attributes output', () => {
    const report = classifyHtml('t.html', '<html><body><p class="intro" id="p1">x</p></body></html>');
    const para = findFirst(report.nodes, (n) => n.tagName === 'p');
    expect(para?.attributes?.['class']).toBeUndefined();
    expect(para?.attributes?.['id']).toBe('p1');
  });
});

describe('classifyHtml - filtering', () => {
  it('whitespace-only text nodes are not emitted', () => {
    const html = '<html><body>\n  \t\n  <p>content</p>\n</body></html>';
    const report = classifyHtml('t.html', html);
    const textNodes = findAll(report.nodes, (n) => n.role === 'text' && /^\s+$/.test(n.text ?? ''));
    expect(textNodes).toHaveLength(0);
  });

  it('script elements are suppressed', () => {
    const html = '<html><body><script>alert("x")</script><p>real</p></body></html>';
    const report = classifyHtml('t.html', html);
    expect(findAll(report.nodes, (n) => n.tagName === 'script')).toHaveLength(0);
  });

  it('style elements are suppressed', () => {
    const html = '<html><body><style>body{}</style><p>real</p></body></html>';
    const report = classifyHtml('t.html', html);
    expect(findAll(report.nodes, (n) => n.tagName === 'style')).toHaveLength(0);
  });

  it('HTML with no semantic content produces zero heading, navigation, and landmark counts', () => {
    const report = classifyHtml('t.html', '<html><body></body></html>');
    expect(report.summary.headingCount).toBe(0);
    expect(report.summary.navigationCount).toBe(0);
    expect(report.summary.landmarks).toHaveLength(0);
  });

  it('a truly empty string produces an empty nodes array', () => {
    const report = classifyHtml('t.html', '');
    expect(report.nodes).toHaveLength(0);
    expect(report.summary.headingCount).toBe(0);
    expect(report.summary.navigationCount).toBe(0);
  });
});

describe('classifyHtml - integration with fixture', () => {
  it('classifies the sample HTML fixture: headings, nav, landmark regions', () => {
    const report = runClassify({ htmlPath: SAMPLE_HTML_PATH });
    expect(report.summary.headingCount).toBeGreaterThanOrEqual(3);
    expect(report.summary.navigationCount).toBeGreaterThanOrEqual(1);
    expect(report.summary.landmarks).toContain('nav');
    expect(report.summary.landmarks).toContain('header');
    expect(report.summary.landmarks).toContain('footer');
  });
});

describe('runClassify - error handling', () => {
  it('throws a descriptive error for a missing file', () => {
    expect(() => runClassify({ htmlPath: '/nonexistent/page.html' })).toThrow('not found');
  });
});
