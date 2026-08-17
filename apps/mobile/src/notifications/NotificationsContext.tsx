import { createContext, useContext, type ReactNode } from 'react';
import { useNotifications } from './useNotifications';

type NotificationsContextValue = ReturnType<typeof useNotifications>;

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

/**
 * Holds the notification list one level above the banner, so screens that make
 * a notification obsolete — logging a pontaj clears the reminder — can refresh
 * it right away instead of waiting for the next foreground refetch.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  return (
    <NotificationsContext.Provider value={useNotifications()}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotificationsContext(): NotificationsContextValue {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotificationsContext must be used within NotificationsProvider');
  }
  return context;
}
