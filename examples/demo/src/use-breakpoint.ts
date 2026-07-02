// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
import { useState, useEffect } from 'react';

export type Breakpoint = 'wide' | 'mid' | 'narrow';

export const WIDE_MIN_PX = 1100;
export const MID_MIN_PX = 640;

export function deriveBreakpoint(width: number): Breakpoint {
  if (width >= WIDE_MIN_PX) return 'wide';
  if (width >= MID_MIN_PX) return 'mid';
  return 'narrow';
}

export function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>(() =>
    typeof window !== 'undefined' ? deriveBreakpoint(window.innerWidth) : 'wide',
  );

  useEffect(() => {
    const wideQuery = window.matchMedia(`(min-width: ${WIDE_MIN_PX}px)`);
    const midQuery = window.matchMedia(`(min-width: ${MID_MIN_PX}px)`);

    function update() {
      setBp(wideQuery.matches ? 'wide' : midQuery.matches ? 'mid' : 'narrow');
    }

    wideQuery.addEventListener('change', update);
    midQuery.addEventListener('change', update);
    return () => {
      wideQuery.removeEventListener('change', update);
      midQuery.removeEventListener('change', update);
    };
  }, []);

  return bp;
}
