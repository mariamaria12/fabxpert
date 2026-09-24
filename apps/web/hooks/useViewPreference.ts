'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuthUser } from '@/context/AuthUserContext';

/**
 * A screen's chosen view (table, calendar…), remembered per user like the
 * column preferences. Falls back to `defaultView` when nothing valid is stored
 * or storage is unavailable.
 */
export function useViewPreference<T extends string>(
  viewId: string,
  allowed: readonly T[],
  defaultView: T,
): [T, (next: T) => void] {
  const user = useAuthUser();
  const storageKey = user?.id ? `view:${user.id}:${viewId}` : null;
  const [view, setViewState] = useState<T>(defaultView);

  useEffect(() => {
    if (!storageKey) {
      return;
    }
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored && (allowed as readonly string[]).includes(stored)) {
        setViewState(stored as T);
      }
    } catch {
      // Storage blocked: the default view is fine.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const setView = useCallback(
    (next: T) => {
      setViewState(next);
      if (!storageKey) {
        return;
      }
      try {
        window.localStorage.setItem(storageKey, next);
      } catch {
        // Storage blocked: the choice lasts for this visit only.
      }
    },
    [storageKey],
  );

  return [view, setView];
}
