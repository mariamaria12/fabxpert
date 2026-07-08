import { useEffect, useState } from 'react';

const DEFAULT_DELAY_MS = 300;

/**
 * Returns true only after `delayMs` of continuous loading, and never while `hasData`.
 * Avoids a flash of "Se încarcă…" on fast responses.
 */
export function useDelayedLoadingLabel(
  isLoading: boolean,
  options?: { delayMs?: number; hasData?: boolean },
): boolean {
  const delayMs = options?.delayMs ?? DEFAULT_DELAY_MS;
  const hasData = options?.hasData ?? false;
  const [pastDelay, setPastDelay] = useState(false);

  useEffect(() => {
    if (!isLoading || hasData) {
      setPastDelay(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setPastDelay(true);
    }, delayMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isLoading, hasData, delayMs]);

  return isLoading && !hasData && pastDelay;
}
