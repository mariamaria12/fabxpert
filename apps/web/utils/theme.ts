/**
 * Color themes of the admin app. 'dark' is the bare :root palette in
 * packages/shared/styles/tokens.css; 'light' and 'gold' are its [data-theme] overrides.
 */
export const THEMES = [
  { id: 'dark', label: 'Întunecat', icon: 'ti-moon' },
  { id: 'light', label: 'Luminos', icon: 'ti-sun' },
  { id: 'gold', label: 'Auriu', icon: 'ti-palette' },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];

export const DEFAULT_THEME: ThemeId = 'dark';

/** Also read by the inline boot script in app/layout.tsx — keep the two in sync. */
export const THEME_STORAGE_KEY = 'fabxpert-theme';

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
  if (theme === DEFAULT_THEME) {
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
