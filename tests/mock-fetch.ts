// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { vi } from 'vitest';

export function mockFetch(html: string, status = 200): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    text: async () => html,
    arrayBuffer: async () => new ArrayBuffer(0),
    headers: { get: () => null },
  }));
}
