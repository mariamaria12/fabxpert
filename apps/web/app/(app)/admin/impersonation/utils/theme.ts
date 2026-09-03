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

/** Separate from the admin's own 'fabxpert-theme' key: this is the employee app's look. */
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

/** Impersonation twin: sets the theme on the phone frame, so the admin page itself keeps its own theme. */
export function applyTheme(theme: ThemeId): void {
  const frame = document.querySelector<HTMLElement>('.imp-phone-frame');
  if (frame) {
    frame.dataset.theme = theme;
  }
}

export function nextTheme(current: ThemeId): ThemeId {
  const index = THEMES.findIndex((theme) => theme.id === current);
  return THEMES[(index + 1) % THEMES.length].id;
}
