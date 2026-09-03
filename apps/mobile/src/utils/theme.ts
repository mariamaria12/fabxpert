/**
 * Color themes of the employee app. 'dark' is the bare :root palette in
 * packages/shared/styles/tokens.css; 'gold' (the original look, and the
 * default here) and 'light' are its [data-theme] overrides.
 */
export const THEMES = [
  { id: 'gold', label: 'Auriu', icon: 'palette' },
  { id: 'dark', label: 'Întunecat', icon: 'moon' },
  { id: 'light', label: 'Luminos', icon: 'sun' },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];
export type ThemeIcon = (typeof THEMES)[number]['icon'];

export const DEFAULT_THEME: ThemeId = 'gold';

/** Also read by the inline boot script in index.html — keep the two in sync. */
export const THEME_STORAGE_KEY = 'fabxpert-mobile-theme';

export function isThemeId(value: unknown): value is ThemeId {
  return THEMES.some((theme) => theme.id === value);
}

export function readStoredTheme(): ThemeId {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeId(stored) ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

/** Sets the theme on <html> and keeps the browser chrome color in step. */
export function applyTheme(theme: ThemeId): void {
  const root = document.documentElement;
  if (theme === 'dark') {
    delete root.dataset.theme;
  } else {
    root.dataset.theme = theme;
  }

  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) {
    meta.content = getComputedStyle(root).getPropertyValue('--color-bg').trim();
  }
}

export function nextTheme(current: ThemeId): ThemeId {
  const index = THEMES.findIndex((theme) => theme.id === current);
  return THEMES[(index + 1) % THEMES.length].id;
}
