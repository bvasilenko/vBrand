// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko

export function minorLineFloor(version: string): string {
  const [major, minor] = version.split('.');
  return `${major}.${minor}.0`;
}
