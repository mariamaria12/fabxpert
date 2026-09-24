'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuthUser } from '@/context/AuthUserContext';

function readStored<T extends string>(storageKey: string | null, allowed: readonly T[]): T | null {
  if (!storageKey || typeof window === 'undefined') {
    return null;
  }
  try {
    const stored = window.localStorage.getItem(storageKey);
    return stored && (allowed as readonly string[]).includes(stored) ? (stored as T) : null;
  } catch {
    // Storage blocked: the default view is fine.
    return null;
  }
}

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
  // Read up front, so a screen does not load its default view first and then
  // load again once the stored one arrives.
  const [view, setViewState] = useState<T>(() => readStored(storageKey, allowed) ?? defaultView);

  useEffect(() => {
    if (!storageKey) {
      return;
    }
    const stored = readStored(storageKey, allowed);
    if (stored) {
      setViewState(stored);
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
