import { dismissNotification, listMyNotifications } from '@fabxpert/shared';
import type { NotificationDto } from '@fabxpert/shared';
import { useCallback, useEffect, useState } from 'react';

/**
 * The user's undismissed notifications. Refetches whenever the app comes back
 * to the foreground, so a push that arrived while it was backgrounded shows up
 * as a banner on return.
 */
export function useNotifications() {
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);

  const refresh = useCallback(async () => {
    try {
      setNotifications(await listMyNotifications());
    } catch {
      /** Offline or logged out — keep whatever is already on screen. */
    }
  }, []);

  useEffect(() => {
    void refresh();

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void refresh();
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [refresh]);

  const dismiss = useCallback(async (id: string) => {
    setNotifications((current) => current.filter((item) => item.id !== id));
    try {
      await dismissNotification(id);
    } catch {
      /** Server didn't record it — it reappears on the next refresh, which is the honest state. */
    }
  }, []);

  return { notifications, dismiss, refresh };
}
