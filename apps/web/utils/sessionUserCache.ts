import type { MeResponse } from '@fabxpert/shared';

const STORAGE_KEY = 'fabxpert.session-user';

/**
 * The signed-in admin, kept for the lifetime of the tab.
 *
 * The shell waits for `/auth/me` before it mounts a page, so on every reload the
 * page's own requests only start one round trip later. Remembering the last
 * answer lets the page render at once while the session is revalidated behind it
 * — the API stays the authority, and a rejected session still redirects.
 */
export function readCachedSessionUser(): MeResponse | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (parsed !== null && typeof parsed === 'object' && 'id' in parsed && 'role' in parsed) {
      return parsed as MeResponse;
    }
    return null;
  } catch {
    return null;
  }
}

export function writeCachedSessionUser(user: MeResponse): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } catch {
    // Private mode / full storage — the shell just waits for /auth/me instead.
  }
}

export function clearCachedSessionUser(): void {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing cached to clear.
  }
}
