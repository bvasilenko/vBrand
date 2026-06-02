// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko

interface ZodIssue {
  path: (string | number)[];
  message: string;
  code?: string;
  expected?: string;
  received?: string;
}

export interface FormattedZodError {
  summary: string;
  fields: Array<{ path: string; message: string }>;
}

function extractZodIssues(message: string): ZodIssue[] | null {
  const bracketIndex = message.indexOf('[');
  if (bracketIndex === -1) return null;
  try {
    const candidate = message.slice(bracketIndex);
    const parsed = JSON.parse(candidate);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    if (typeof parsed[0] !== 'object' || !('message' in parsed[0])) return null;
    return parsed as ZodIssue[];
  } catch {
    return null;
  }
}

export function formatZodError(message: string): FormattedZodError | null {
  const issues = extractZodIssues(message);
  if (!issues) return null;

  const fields = issues.map((issue) => ({
    path: issue.path.length > 0 ? issue.path.join('.') : '(root)',
    message: issue.message,
  }));

  const summary = `JSON payload validation failed: ${issues.length} issue${issues.length === 1 ? '' : 's'}`;
  return { summary, fields };
}
