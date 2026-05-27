// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { parse, HTMLElement, Node, NodeType } from 'node-html-parser';

export type NodeRole =
  | 'heading'
  | 'navigation'
  | 'header'
  | 'footer'
  | 'main'
  | 'section'
  | 'article'
  | 'aside'
  | 'paragraph'
  | 'link'
  | 'list'
  | 'list-item'
  | 'button'
  | 'form'
  | 'image'
  | 'text'
  | 'unknown';

export interface ClassifiedNode {
  role: NodeRole;
  tagName?: string;
  level?: number;
  text?: string;
  attributes?: Record<string, string>;
  children: ClassifiedNode[];
  path: string;
}

export interface ClassifyReport {
  sourcePath: string;
  nodes: ClassifiedNode[];
  summary: {
    nodeCount: number;
    headingCount: number;
    navigationCount: number;
    landmarks: string[];
  };
}

const HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
const LANDMARK_TAGS = new Set(['nav', 'header', 'footer', 'main', 'section', 'article', 'aside']);
const ROLE_MAP: Record<string, NodeRole> = {
  nav: 'navigation',
  header: 'header',
  footer: 'footer',
  main: 'main',
  section: 'section',
  article: 'article',
  aside: 'aside',
  p: 'paragraph',
  a: 'link',
  ul: 'list',
  ol: 'list',
  li: 'list-item',
  button: 'button',
  form: 'form',
  img: 'image',
};

function resolveRole(tagName: string): NodeRole {
  if (HEADING_TAGS.has(tagName)) return 'heading';
  return ROLE_MAP[tagName] ?? 'unknown';
}

function attributesOf(el: HTMLElement): Record<string, string> | undefined {
  const attrs: Record<string, string> = {};
  let hasAny = false;
  for (const [key, val] of Object.entries(el.attributes)) {
    if (key !== 'class') {
      attrs[key] = val;
      hasAny = true;
    }
  }
  return hasAny ? attrs : undefined;
}

function convertNode(node: Node, path: string): ClassifiedNode | null {
  if (node.nodeType === NodeType.TEXT_NODE) {
    const text = node.text.trim();
    if (!text) return null;
    return { role: 'text', text, children: [], path };
  }

  if (node.nodeType !== NodeType.ELEMENT_NODE) return null;

  const el = node as HTMLElement;
  const tag = el.tagName?.toLowerCase() ?? '';
  if (!tag || tag === 'script' || tag === 'style' || tag === 'meta' || tag === 'link' || tag === 'head') return null;

  const role = resolveRole(tag);
  const classified: ClassifiedNode = {
    role,
    tagName: tag,
    children: [],
    path,
  };

  if (role === 'heading') {
    classified.level = parseInt(tag[1] ?? '1', 10);
    classified.text = el.text.trim() || undefined;
  }

  if (role === 'text' || role === 'link' || role === 'paragraph') {
    classified.text = el.text.trim() || undefined;
  }

  const attrs = attributesOf(el);
  if (attrs) classified.attributes = attrs;

  let childIndex = 0;
  for (const child of el.childNodes) {
    const childNode = convertNode(child, `${path}/${childIndex}`);
    if (childNode) {
      classified.children.push(childNode);
      childIndex++;
    }
  }

  return classified;
}

function countInTree(nodes: ClassifiedNode[], role: NodeRole): number {
  let count = 0;
  for (const node of nodes) {
    if (node.role === role) count++;
    count += countInTree(node.children, role);
  }
  return count;
}

function collectLandmarks(nodes: ClassifiedNode[]): string[] {
  const found = new Set<string>();
  for (const node of nodes) {
    if (LANDMARK_TAGS.has(node.tagName ?? '')) found.add(node.tagName!);
    for (const landmark of collectLandmarks(node.children)) found.add(landmark);
  }
  return [...found].sort();
}

export function classifyHtml(sourcePath: string, html: string): ClassifyReport {
  const root = parse(html, { comment: false, blockTextElements: { script: false, style: false } });

  const nodes: ClassifiedNode[] = [];
  let index = 0;
  for (const child of root.childNodes) {
    const converted = convertNode(child, String(index));
    if (converted) {
      nodes.push(converted);
      index++;
    }
  }

  return {
    sourcePath,
    nodes,
    summary: {
      nodeCount: nodes.length,
      headingCount: countInTree(nodes, 'heading'),
      navigationCount: countInTree(nodes, 'navigation'),
      landmarks: collectLandmarks(nodes),
    },
  };
}
