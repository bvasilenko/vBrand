// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { z } from 'zod';

export interface VoiceProvider {
  generateObject<T>(options: {
    model: string;
    system: string;
    prompt: string;
    schema: z.ZodType<T>;
    maxTokens?: number;
  }): Promise<T>;
}

interface OpenAIChatResponse {
  choices?: Array<{
    message?: { content?: string };
  }>;
}

export function createOpenAICompatibleProvider(
  baseUrl: string,
  apiKey: string,
): VoiceProvider {
  return {
    async generateObject({ model, system, prompt, schema, maxTokens = 2000 }) {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: prompt },
          ],
          response_format: { type: 'json_object' },
          max_tokens: maxTokens,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Voice provider error: HTTP ${response.status} ${response.statusText}`,
        );
      }

      const data = (await response.json()) as OpenAIChatResponse;
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error('Voice provider returned empty response');

      const parsed: unknown = JSON.parse(content);
      return schema.parse(parsed);
    },
  };
}

export function createVoiceProviderFromEnv(): VoiceProvider | undefined {
  const baseUrl = process.env['OPENAI_BASE_URL'];
  const apiKey = process.env['OPENAI_API_KEY'];
  if (!baseUrl || !apiKey) return undefined;
  return createOpenAICompatibleProvider(baseUrl, apiKey);
}
