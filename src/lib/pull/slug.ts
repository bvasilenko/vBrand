// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko

export function sourceToSlug(source: string): string {
  if (source.startsWith('gh:')) return `gh-${slugSegment(source.slice(3))}`;
  if (source.startsWith('npm:')) return `npm-${slugSegment(source.slice(4))}`;
  if (source.startsWith('https://') || source.startsWith('http://')) {
    try {
      const url = new URL(source);
      const host = slugSegment(url.hostname);
      const pathPart =
        url.pathname === '/' || url.pathname === ''
          ? ''
          : `-${slugSegment(url.pathname)}`;
      return `${host}${pathPart}`.slice(0, 80);
    } catch {
      return slugSegment(source);
    }
  }
  return `local-${slugSegment(source)}`;
}

function slugSegment(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
