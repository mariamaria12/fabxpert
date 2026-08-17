import { ApiError, getMe } from '@fabxpert/shared';
import type { MeResponse } from '@fabxpert/shared';
import { useEffect, useState } from 'react';
import { TimesheetFlow } from './components/TimesheetFlow';
import { LoginScreen } from './LoginScreen';
import { MobileLookupCacheProvider } from './context/MobileLookupCacheContext';
import { NotificationsProvider } from './notifications/NotificationsContext';

const SESSION_RETRY_DELAY_MS = 1500;

/** Only a real rejection by the API means "not logged in". */
function isAuthFailure(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}

/**
 * A phone on a weak signal — or an API that's briefly restarting — makes `getMe`
 * fail without the session being gone. Retrying once keeps the worker logged in
 * instead of dropping them on the login screen. Mirrors the web AppShell.
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

export default function App() {
  const [user, setUser] = useState<MeResponse | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetchSessionUser()
      .then((me) => {
        if (!cancelled && me.role === 'EMPLOYEE' && me.isActive) {
          setUser(me);
        }
      })
      .catch(() => {
        // No valid session — stay on login.
      })
      .finally(() => {
        if (!cancelled) {
          setIsCheckingSession(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (isCheckingSession) {
    return null;
  }

  if (user) {
    return (
      <MobileLookupCacheProvider>
        <NotificationsProvider>
          <TimesheetFlow user={user} onLogout={() => setUser(null)} />
        </NotificationsProvider>
      </MobileLookupCacheProvider>
    );
  }

  return <LoginScreen onSuccess={setUser} />;
}
