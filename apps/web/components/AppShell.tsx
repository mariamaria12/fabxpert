'use client';

import { getMe, logout } from '@fabxpert/shared';
import type { MeResponse } from '@fabxpert/shared';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AuthUserProvider } from '@/context/AuthUserContext';
import { Sidebar } from './Sidebar';
import { TimesheetNotificationSlot } from './TimesheetNotificationSlot';
import { TimesheetEventsProvider } from '@/context/TimesheetEventsContext';

const SIDEBAR_COLLAPSED_KEY = 'fabxpert.sidebar-collapsed';

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<MeResponse | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

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
    getMe()
      .then(async (me) => {
        if (cancelled) {
          return;
        }

        if (me.role !== 'ADMIN') {
          await logout();
          router.replace('/login');
          return;
        }

        setUser(me);
        setAuthReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          router.replace('/login');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  function toggleCollapsed() {
    const next = !collapsed;
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
    setCollapsed(next);
  }

  if (!authReady) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg">
        <p className="text-sm text-text-muted">Se încarcă…</p>
      </div>
    );
  }

  return (
    <AuthUserProvider user={user}>
      <TimesheetEventsProvider enabled={authReady}>
        <div className="flex min-h-dvh bg-bg">
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
            <header className="flex items-center border-b border-border-subtle px-3 py-2 sm:hidden">
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                title="Meniu"
                className="text-text-secondary hover:text-text-primary"
              >
                <i className="ti ti-menu-2 text-xl" aria-hidden="true" />
              </button>
            </header>

            <main className="relative flex-1 p-6">
              {children}
              <TimesheetNotificationSlot />
            </main>
          </div>
        </div>
      </TimesheetEventsProvider>
    </AuthUserProvider>
  );
}
