// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { VbrandType } from '../../schema.js';

export interface SlotFinding {
  slotName: string;
  reason: 'placeholder' | 'empty';
}

export function checkSlots(schema: VbrandType): SlotFinding[] {
  const findings: SlotFinding[] = [];
  if (!schema.slots) return findings;

  for (const [name, slot] of Object.entries(schema.slots)) {
    if (!slot.value) {
      findings.push({ slotName: name, reason: 'empty' });
    } else if (slot.placeholder && slot.value === slot.placeholder) {
      findings.push({ slotName: name, reason: 'placeholder' });
    }
  }
  return findings;
}
