'use client';

import type { TimesheetEvent } from '@fabxpert/shared';
import { useEffect, useRef, useState } from 'react';
import { useTimesheetEvents } from '@/context/TimesheetEventsContext';
import { timesheetEventMessage } from '@/utils/timesheetEvents';

const AUTO_DISMISS_MS = 10_000;

export function TimesheetNotificationSlot() {
  const { subscribe } = useTimesheetEvents();
  const [notification, setNotification] = useState<TimesheetEvent | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return subscribe((event) => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }

      setNotification(event);
      timerRef.current = window.setTimeout(() => {
        setNotification(null);
        timerRef.current = null;
      }, AUTO_DISMISS_MS);
    });
  }, [subscribe]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  function dismissEarly() {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setNotification(null);
  }

  if (!notification) {
    return null;
  }

  // Bottom-right and under panels and dialogs: across the top it covered the
  // page's first row — the pontaj steps — and took their clicks for ten seconds.
  // Above the toasts on phones, beside them from `sm` up.
  return (
    <div
      className="pointer-events-none fixed inset-x-4 bottom-20 z-40 flex justify-end sm:inset-x-auto sm:bottom-6 sm:right-6"
      aria-live="polite"
    >
      <button
        type="button"
        onClick={dismissEarly}
        className="pointer-events-auto flex min-w-0 max-w-sm items-center gap-2 rounded-md border border-accent/30 bg-surface px-3 py-2.5 text-left text-sm text-text-primary shadow-popover transition-opacity hover:opacity-90"
      >
        <i className="ti ti-bell shrink-0 text-base text-accent" aria-hidden="true" />
        <span className="min-w-0 truncate">{timesheetEventMessage(notification)}</span>
      </button>
    </div>
  );
}
