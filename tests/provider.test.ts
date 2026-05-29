// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  createOpenAICompatibleProvider,
  createVoiceProviderFromEnv,
} from '../src/lib/voice/provider.js';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

const SIMPLE_SCHEMA = z.object({ title: z.string() });

function makeMockFetch(opts: {
  ok?: boolean;
  status?: number;
  statusText?: string;
  body?: unknown;
}): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue({
    ok: opts.ok ?? true,
    status: opts.status ?? 200,
    statusText: opts.statusText ?? 'OK',
    json: () =>
      Promise.resolve(
        opts.body ?? {
          choices: [{ message: { content: JSON.stringify({ title: 'test' }) } }],
        },
      ),
  });
}

describe('createVoiceProviderFromEnv - environment detection', () => {
  it('returns undefined when OPENAI_BASE_URL is not set', () => {
    vi.stubEnv('OPENAI_BASE_URL', '');
    vi.stubEnv('OPENAI_API_KEY', 'key');
    expect(createVoiceProviderFromEnv()).toBeUndefined();
  });

  it('returns undefined when OPENAI_API_KEY is not set', () => {
    vi.stubEnv('OPENAI_BASE_URL', 'https://api.example.com/v1');
    vi.stubEnv('OPENAI_API_KEY', '');
    expect(createVoiceProviderFromEnv()).toBeUndefined();
  });

  it('returns undefined when both env vars are absent', () => {
    vi.stubEnv('OPENAI_BASE_URL', '');
    vi.stubEnv('OPENAI_API_KEY', '');
    expect(createVoiceProviderFromEnv()).toBeUndefined();
  });

  it('returns a VoiceProvider when both env vars are set', () => {
    vi.stubEnv('OPENAI_BASE_URL', 'https://api.example.com/v1');
    vi.stubEnv('OPENAI_API_KEY', 'sk-test');
    const provider = createVoiceProviderFromEnv();
    expect(provider).toBeDefined();
    expect(typeof provider!.generateObject).toBe('function');
  });
});

describe('createOpenAICompatibleProvider - generateObject', () => {
  it('calls the correct endpoint', async () => {
    const mockFetch = makeMockFetch({});
    vi.stubGlobal('fetch', mockFetch);
    const provider = createOpenAICompatibleProvider(
      'https://api.example.com/v1',
      'sk-test',
    );
    await provider.generateObject({
      model: 'gpt-4',
      system: 'You are helpful.',
      prompt: 'Generate something.',
      schema: SIMPLE_SCHEMA,
    });
    expect(mockFetch).toHaveBeenCalledOnce();
    const url = mockFetch.mock.calls[0]![0] as string;
    expect(url).toBe('https://api.example.com/v1/chat/completions');
  });

  it('sends Authorization header with Bearer token', async () => {
    const mockFetch = makeMockFetch({});
    vi.stubGlobal('fetch', mockFetch);
    const provider = createOpenAICompatibleProvider(
      'https://api.example.com/v1',
      'sk-secret',
    );
    await provider.generateObject({
      model: 'gpt-4',
      system: 'sys',
      prompt: 'prompt',
      schema: SIMPLE_SCHEMA,
    });
    const init = mockFetch.mock.calls[0]![1] as RequestInit;
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer sk-secret');
  });

  it('returns parsed and validated result matching the provided schema', async () => {
    vi.stubGlobal('fetch', makeMockFetch({ body: { choices: [{ message: { content: JSON.stringify({ title: 'hello' }) } }] } }));
    const provider = createOpenAICompatibleProvider('https://x.com/v1', 'key');
    const result = await provider.generateObject({
      model: 'm',
      system: 's',
      prompt: 'p',
      schema: SIMPLE_SCHEMA,
    });
    expect(result).toEqual({ title: 'hello' });
  });

  it('throws a descriptive error on HTTP error status', async () => {
    vi.stubGlobal('fetch', makeMockFetch({ ok: false, status: 429, statusText: 'Too Many Requests' }));
    const provider = createOpenAICompatibleProvider('https://x.com/v1', 'key');
    await expect(
      provider.generateObject({ model: 'm', system: 's', prompt: 'p', schema: SIMPLE_SCHEMA }),
    ).rejects.toThrow(/Voice provider error/);
  });

  it('throws when response content is empty', async () => {
    vi.stubGlobal(
      'fetch',
      makeMockFetch({ body: { choices: [{ message: { content: '' } }] } }),
    );
    const provider = createOpenAICompatibleProvider('https://x.com/v1', 'key');
    await expect(
      provider.generateObject({ model: 'm', system: 's', prompt: 'p', schema: SIMPLE_SCHEMA }),
    ).rejects.toThrow(/empty response/);
  });

  it('throws when choices array is missing', async () => {
    vi.stubGlobal('fetch', makeMockFetch({ body: {} }));
    const provider = createOpenAICompatibleProvider('https://x.com/v1', 'key');
    await expect(
      provider.generateObject({ model: 'm', system: 's', prompt: 'p', schema: SIMPLE_SCHEMA }),
    ).rejects.toThrow();
  });

  it('throws ZodError when response content fails schema validation', async () => {
    vi.stubGlobal(
      'fetch',
      makeMockFetch({
        body: { choices: [{ message: { content: JSON.stringify({ wrong: 'field' }) } }] },
      }),
    );
    const provider = createOpenAICompatibleProvider('https://x.com/v1', 'key');
    await expect(
      provider.generateObject({ model: 'm', system: 's', prompt: 'p', schema: SIMPLE_SCHEMA }),
    ).rejects.toThrow();
  });

  it('uses default maxTokens of 2000 when not specified', async () => {
    const mockFetch = makeMockFetch({});
    vi.stubGlobal('fetch', mockFetch);
    const provider = createOpenAICompatibleProvider('https://x.com/v1', 'key');
    await provider.generateObject({ model: 'm', system: 's', prompt: 'p', schema: SIMPLE_SCHEMA });
    const init = mockFetch.mock.calls[0]![1] as RequestInit;
    const body = JSON.parse(init.body as string) as { max_tokens: number };
    expect(body.max_tokens).toBe(2000);
  });

  it('forwards custom maxTokens when specified', async () => {
    const mockFetch = makeMockFetch({});
    vi.stubGlobal('fetch', mockFetch);
    const provider = createOpenAICompatibleProvider('https://x.com/v1', 'key');
    await provider.generateObject({
      model: 'm', system: 's', prompt: 'p', schema: SIMPLE_SCHEMA, maxTokens: 500,
    });
    const init = mockFetch.mock.calls[0]![1] as RequestInit;
    const body = JSON.parse(init.body as string) as { max_tokens: number };
    expect(body.max_tokens).toBe(500);
  });
});
