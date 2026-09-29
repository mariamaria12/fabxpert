'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

/** Same name Rapoarte uses, so every page that opens a fișa reads alike. */
export const OPEN_REPORT_PARAM = 'report';

/**
 * The project whose report (fișa) is open, mirrored in the address as
 * `?report=`, so Back from the pontaje the fișa links to reopens it.
 */
export function useOpenReportParam() {
  const searchParams = useSearchParams();
  const [projectId, setProjectId] = useState<string | null>(() =>
    searchParams.get(OPEN_REPORT_PARAM),
  );

  // A history swap, not a router navigation: opening a fișa shouldn't
  // re-render the page behind it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (projectId) {
      params.set(OPEN_REPORT_PARAM, projectId);
    } else {
      params.delete(OPEN_REPORT_PARAM);
    }
    const query = params.toString();
    const href = `${window.location.pathname}${query ? `?${query}` : ''}`;
    if (href !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState(null, '', href);
    }
  }, [projectId]);

  return [projectId, setProjectId] as const;
}
