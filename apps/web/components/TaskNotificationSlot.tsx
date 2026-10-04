'use client';

import type { NotificationDto } from '@fabxpert/shared';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useTasks } from '@/context/TasksContext';
import { taskHref } from '@/utils/taskNavigation';

const AUTO_DISMISS_MS = 10_000;

/** Shows a task notification the moment it arrives; a click opens the task. */
export function TaskNotificationSlot() {
  const router = useRouter();
  const { onNotification, markRead } = useTasks();
  const [notification, setNotification] = useState<NotificationDto | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return onNotification((incoming) => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }

      setNotification(incoming);
      timerRef.current = window.setTimeout(() => {
        setNotification(null);
        timerRef.current = null;
      }, AUTO_DISMISS_MS);
    });
  }, [onNotification]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  function dismiss() {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setNotification(null);
  }

  if (!notification) {
    return null;
  }

  function open(target: NotificationDto) {
    markRead(target.id);
    dismiss();
    if (target.taskId) {
      router.push(taskHref({ taskId: target.taskId }));
    }
  }

  // Bottom-right, one step above the pontaj notification so both can show.
  return (
    <div
      className="pointer-events-none fixed inset-x-4 bottom-36 z-40 flex justify-end sm:inset-x-auto sm:bottom-20 sm:right-6"
      aria-live="polite"
    >
      <div className="pointer-events-auto flex w-full max-w-sm items-start gap-1 rounded-md border border-accent/30 bg-surface shadow-popover">
        <button
          type="button"
          onClick={() => open(notification)}
          className="flex min-w-0 flex-1 items-start gap-2.5 px-3 py-2.5 text-left transition-opacity hover:opacity-90"
        >
          <i
            className="ti ti-list-check mt-0.5 shrink-0 text-base text-accent"
            aria-hidden="true"
          />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-text-primary">
              {notification.title}
            </span>
            <span className="block truncate text-xs text-text-secondary">{notification.body}</span>
          </span>
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Închide notificarea"
          title="Închide"
          className="m-1 flex size-7 shrink-0 items-center justify-center rounded text-text-muted hover:bg-surface-raised hover:text-text-primary"
        >
          <i className="ti ti-x text-sm" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
