'use client';

import { useEffect, useState } from 'react';

/** Same breakpoint as the sidebar collapse: below Tailwind's `md`. */
const MOBILE_MEDIA_QUERY = '(max-width: 767px)';

/**
 * `false` on the server and on the first client render, so markup matches and
 * hydration stays quiet; the real value lands in the effect right after.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(MOBILE_MEDIA_QUERY);
    setIsMobile(media.matches);

    const handleChange = (event: MediaQueryListEvent) => setIsMobile(event.matches);
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  return isMobile;
}
