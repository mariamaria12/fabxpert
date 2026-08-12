'use client';

import { useEffect, useState } from 'react';

/** Same breakpoint as the sidebar collapse: below Tailwind's `md`. */
const DEFAULT_MOBILE_MAX_WIDTH_PX = 767;

/**
 * `false` on the server and on the first client render, so markup matches and
 * hydration stays quiet; the real value lands in the effect right after.
 */
export function useIsMobile(maxWidthPx: number = DEFAULT_MOBILE_MAX_WIDTH_PX): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(`(max-width: ${maxWidthPx}px)`);
    setIsMobile(media.matches);

    const handleChange = (event: MediaQueryListEvent) => setIsMobile(event.matches);
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, [maxWidthPx]);

  return isMobile;
}
