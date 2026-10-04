'use client';

import {
  getNotificationInbox,
  getTaskAttentionCount,
  listProjectTaskCounts,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToTasks,
  type NotificationDto,
  type ProjectTaskCountsDto,
} from '@fabxpert/shared';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

type TasksChangedListener = () => void;
type NotificationListener = (notification: NotificationDto) => void;

type TasksContextValue = {
  /** The signed-in user's tasks that are overdue or due today — the sidebar badge. */
  attentionCount: number;
  /** Open and overdue tasks of every project that has any, by project id. */
  projectTaskCounts: ReadonlyMap<string, ProjectTaskCountsDto>;
  notifications: NotificationDto[];
  unreadCount: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
  /** Runs `listener` whenever any task changes, here or in someone else's app. */
  onTasksChanged: (listener: TasksChangedListener) => () => void;
  /** Runs `listener` when a notification for this user arrives live. */
  onNotification: (listener: NotificationListener) => () => void;
};

const TasksContext = createContext<TasksContextValue | null>(null);

/** How long task changes are gathered before the app reloads what shows them. */
const RELOAD_DELAY_MS = 300;

/**
 * Keeps the task badge, the per-project counters and the notification inbox
 * current: loaded once, then moved by the live stream. Everything here is best-effort — a failed fetch
 * leaves the last known values in place.
 */
export function TasksProvider({ children, enabled }: { children: ReactNode; enabled: boolean }) {
  const [attentionCount, setAttentionCount] = useState(0);
  const [projectCounts, setProjectCounts] = useState<ProjectTaskCountsDto[]>([]);
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const changedListenersRef = useRef(new Set<TasksChangedListener>());
  const notificationListenersRef = useRef(new Set<NotificationListener>());

  const refreshCounts = useCallback(async () => {
    try {
      const [attention, counts] = await Promise.all([
        getTaskAttentionCount(),
        listProjectTaskCounts(),
      ]);
      setAttentionCount(attention.count);
      setProjectCounts(counts);
    } catch {
      // Keep the last known counts.
    }
  }, []);

  const refreshInbox = useCallback(async () => {
    try {
      const inbox = await getNotificationInbox();
      setNotifications(inbox.notifications);
      setUnreadCount(inbox.unreadCount);
    } catch {
      // Keep the last known inbox.
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    // A burst of changes — ten checklist ticks, a reconnect — reloads once.
    let reloadTimer: number | null = null;
    const reloadSoon = () => {
      if (reloadTimer !== null) {
        return;
      }
      reloadTimer = window.setTimeout(() => {
        reloadTimer = null;
        void refreshCounts();
        // A removed task takes its notifications with it.
        void refreshInbox();
        for (const listener of changedListenersRef.current) {
          listener();
        }
      }, RELOAD_DELAY_MS);
    };

    void refreshCounts();
    void refreshInbox();

    let connectedBefore = false;
    const unsubscribe = subscribeToTasks({
      onConnected: () => {
        // Whatever was sent while the stream was down is gone: catch up.
        if (connectedBefore) {
          reloadSoon();
        }
        connectedBefore = true;
      },
      onEvent: (event) => {
        if (event.type === 'tasks-changed') {
          reloadSoon();
          return;
        }

        void refreshInbox();
        for (const listener of notificationListenersRef.current) {
          listener(event.notification);
        }
      },
    });

    return () => {
      unsubscribe();
      if (reloadTimer !== null) {
        window.clearTimeout(reloadTimer);
      }
    };
  }, [enabled, refreshCounts, refreshInbox]);

  const markRead = useCallback(
    (id: string) => {
      setNotifications((current) =>
        current.map((item) =>
          item.id === id && item.readAt === null
            ? { ...item, readAt: new Date().toISOString() }
            : item,
        ),
      );
      void markNotificationRead(id)
        .catch(() => undefined)
        .then(refreshInbox);
    },
    [refreshInbox],
  );

  const markAllRead = useCallback(() => {
    const readAt = new Date().toISOString();
    setNotifications((current) =>
      current.map((item) => (item.readAt === null ? { ...item, readAt } : item)),
    );
    setUnreadCount(0);
    void markAllNotificationsRead()
      .catch(() => undefined)
      .then(refreshInbox);
  }, [refreshInbox]);

  const onTasksChanged = useCallback((listener: TasksChangedListener) => {
    changedListenersRef.current.add(listener);
    return () => {
      changedListenersRef.current.delete(listener);
    };
  }, []);

  const onNotification = useCallback((listener: NotificationListener) => {
    notificationListenersRef.current.add(listener);
    return () => {
      notificationListenersRef.current.delete(listener);
    };
  }, []);

  const projectTaskCounts = useMemo(
    () => new Map(projectCounts.map((counts) => [counts.project.id, counts])),
    [projectCounts],
  );

  const value = useMemo(
    () => ({
      attentionCount,
      projectTaskCounts,
      notifications,
      unreadCount,
      markRead,
      markAllRead,
      onTasksChanged,
      onNotification,
    }),
    [
      attentionCount,
      projectTaskCounts,
      notifications,
      unreadCount,
      markRead,
      markAllRead,
      onTasksChanged,
      onNotification,
    ],
  );

  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>;
}

export function useTasks(): TasksContextValue {
  const context = useContext(TasksContext);
  if (!context) {
    throw new Error('useTasks must be used within TasksProvider');
  }
  return context;
}

/** Calls `reload` whenever tasks change anywhere — for lists that show them. */
export function useReloadOnTasksChanged(reload: () => void): void {
  const { onTasksChanged } = useTasks();
  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  useEffect(() => onTasksChanged(() => reloadRef.current()), [onTasksChanged]);
}
