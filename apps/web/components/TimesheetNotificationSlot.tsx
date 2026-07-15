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

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-50 px-6 pt-6"
      aria-live="polite"
    >
      <button
        type="button"
        onClick={dismissEarly}
        className="pointer-events-auto flex w-full items-center gap-2 rounded-md border border-accent/30 bg-surface px-3 py-2.5 text-left text-sm text-text-primary shadow-popover transition-opacity hover:opacity-90"
      >
        <i className="ti ti-bell shrink-0 text-base text-accent" aria-hidden="true" />
        <span className="min-w-0 truncate">{timesheetEventMessage(notification)}</span>
      </button>
    </div>
  );
}
