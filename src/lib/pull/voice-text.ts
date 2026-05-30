// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko

const TITLE_TRAILER_RE = /\s*[|–—-]\s*.+$/;
const EM_DASH_RE = /—/g;
const EN_DASH = '–';
const FLAG_EMOJI_RE = /[\u{1F1E0}-\u{1F1FF}]{2}/gu;

export function sanitizeVoiceText(raw: string): string {
  return raw.replace(EM_DASH_RE, EN_DASH).replace(FLAG_EMOJI_RE, '');
}

export function stripTitleTrailer(title: string): string {
  return title.replace(TITLE_TRAILER_RE, '').trim() || title;
}
