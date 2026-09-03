'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  applyTheme,
  DEFAULT_THEME,
  readStoredTheme,
  THEME_STORAGE_KEY,
  type ThemeId,
} from '@/utils/theme';

/**
 * Current color theme and a setter that persists it. The boot script in
 * layout.tsx already applied the stored theme before paint; this just mirrors
 * it into React state after mount so the UI can show which one is active.
 */
export function useTheme(): { theme: ThemeId; setTheme: (theme: ThemeId) => void } {
  const [theme, setThemeState] = useState<ThemeId>(DEFAULT_THEME);

  useEffect(() => {
    setThemeState(readStoredTheme());
  }, []);

  const setTheme = useCallback((next: ThemeId) => {
    setThemeState(next);
    applyTheme(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Private mode or blocked storage: the theme still applies for this visit.
    }
  }, []);

  return { theme, setTheme };
}
