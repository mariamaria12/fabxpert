'use client';

import { ApiError, getMe, logout } from '@fabxpert/shared';
import type { MeResponse } from '@fabxpert/shared';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type CSSProperties } from 'react';
import { AuthUserProvider } from '@/context/AuthUserContext';
import {
  clearCachedSessionUser,
  readCachedSessionUser,
  writeCachedSessionUser,
} from '@/utils/sessionUserCache';
import { MobileHeaderSlotProvider } from '@/components/MobileHeaderAction';
import { navLabelForPathname } from '@/components/navItems';
import { useIsMobile } from '@/hooks/useIsMobile';
import { Sidebar } from './Sidebar';
import { TimesheetNotificationSlot } from './TimesheetNotificationSlot';
import { TimesheetEventsProvider } from '@/context/TimesheetEventsContext';

const SIDEBAR_COLLAPSED_KEY = 'fabxpert.sidebar-collapsed';

const SESSION_RETRY_DELAY_MS = 1500;

/** Only a real rejection by the API means "not logged in". */
function isAuthFailure(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}

/**
 * Flaky mobile connections (backgrounded tab, weak signal, cold start) make
 * `getMe` fail with a network error. Retrying once keeps a valid session alive
 * instead of bouncing the user to the login screen.
 */
async function fetchSessionUser(): Promise<MeResponse> {
  try {
    return await getMe();
  } catch (error) {
    if (isAuthFailure(error)) {
      throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, SESSION_RETRY_DELAY_MS));
    return getMe();
  }
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<MeResponse | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sessionError, setSessionError] = useState(false);
  const [sessionAttempt, setSessionAttempt] = useState(0);
  // The sticky header exists only below `sm`; pages portal their actions into it.
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  const showMobileHeaderSlot = useIsMobile(639);

  // Render from the last known session so the page below can start its own
  // requests immediately; `/auth/me` still runs and still has the last word.
  useEffect(() => {
    const cached = readCachedSessionUser();
    if (cached) {
      setUser(cached);
      setAuthReady(true);
    }
  }, []);

  // Restore the persisted collapse preference; with no stored preference,
  // default to icon-only below Tailwind's `md` breakpoint.
  useEffect(() => {
    const stored = window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (stored !== null) {
      setCollapsed(stored === '1');
    } else if (window.matchMedia('(max-width: 767px)').matches) {
      setCollapsed(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setSessionError(false);

    fetchSessionUser()
      .then(async (me) => {
        if (cancelled) {
          return;
        }

        if (me.role !== 'ADMIN') {
          clearCachedSessionUser();
          await logout();
          router.replace('/login');
          return;
        }

        writeCachedSessionUser(me);
        setUser(me);
        setAuthReady(true);
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        if (isAuthFailure(error)) {
          clearCachedSessionUser();
          router.replace('/login');
          return;
        }

        // Session is probably fine — the request never reached the API.
        setSessionError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [router, sessionAttempt]);

  function toggleCollapsed() {
    const next = !collapsed;
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
    setCollapsed(next);
  }

  if (!authReady) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-bg px-6 text-center">
        {sessionError ? (
          <>
            <p className="text-sm text-text-secondary">
              Nu s-a putut contacta serverul. Conexiunea pare întreruptă.
            </p>
            <button
              type="button"
              onClick={() => setSessionAttempt((current) => current + 1)}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
            >
              Reîncearcă
            </button>
          </>
        ) : (
          <p className="text-sm text-text-muted">Se încarcă…</p>
        )}
      </div>
    );
  }

  return (
    <AuthUserProvider user={user}>
      <MobileHeaderSlotProvider value={headerSlot}>
      <TimesheetEventsProvider enabled={authReady}>
        {/* Exposes the sidebar width so overlays (e.g. SlideOverPanel) can stop at it. */}
        <div
          className="flex min-h-dvh bg-bg"
          style={{ '--sidebar-width': collapsed ? '3.5rem' : '200px' } as CSSProperties}
        >
          {/* Static sidebar — sm and up */}
          <Sidebar
            className="sticky top-0 hidden h-dvh sm:flex"
            collapsed={collapsed}
            user={user}
            onToggleCollapse={toggleCollapsed}
          />

          {/* Overlay drawer — below sm */}
          {drawerOpen && (
            <div className="fixed inset-0 z-40 sm:hidden">
              <div
                className="absolute inset-0 bg-bg/70"
                onClick={() => setDrawerOpen(false)}
                aria-hidden="true"
              />
              <Sidebar
                className="absolute inset-y-0 left-0 flex"
                collapsed={false}
                user={user}
                onNavigate={() => setDrawerOpen(false)}
              />
            </div>
          )}

          <div className="flex min-w-0 flex-1 flex-col">
            {/* Top bar with hamburger — below sm only */}
            {/* Sticky so the menu and the page name stay reachable while scrolling. */}
            <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border-subtle bg-bg px-3 py-2 sm:hidden">
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                title="Meniu"
                aria-label="Meniu"
                className="shrink-0 text-text-secondary hover:text-text-primary"
              >
                <i className="ti ti-menu-2 text-xl" aria-hidden="true" />
              </button>
              <span className="min-w-0 truncate text-base font-medium text-text-primary">
                {navLabelForPathname(pathname)}
              </span>
              {showMobileHeaderSlot && (
                <div ref={setHeaderSlot} className="ml-auto flex shrink-0 items-center gap-2" />
              )}
            </header>

            {/* overflow-x-hidden keeps the page itself from sliding sideways —
                wide content (tables) scrolls inside its own container. */}
            <main className="relative min-w-0 flex-1 overflow-x-hidden px-4 pb-6 pt-3 sm:p-6">
              {children}
              <TimesheetNotificationSlot />
            </main>
          </div>
        </div>
      </TimesheetEventsProvider>
      </MobileHeaderSlotProvider>
    </AuthUserProvider>
  );
}
