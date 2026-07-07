'use client';

import type { TimesheetEvent } from '@fabxpert/shared';
import { useEffect, useRef, useState } from 'react';
import { useTimesheetEvents } from '@/context/TimesheetEventsContext';
import { timesheetEventMessage } from '@/utils/timesheetEvents';

const AUTO_DISMISS_MS = 10_000;

/** Fixed height reserved above page content — prevents layout shift. */
export const TIMESHEET_NOTIFICATION_SLOT_CLASS = 'mb-4 h-10 shrink-0';

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

  return (
    <div className={TIMESHEET_NOTIFICATION_SLOT_CLASS} aria-live="polite">
      {notification && (
        <button
          type="button"
          onClick={dismissEarly}
          className="flex h-full w-full items-center gap-2 rounded-md border border-accent/30 bg-surface px-3 text-left text-sm text-text-primary transition-opacity hover:opacity-90"
        >
          <i className="ti ti-bell shrink-0 text-base text-accent" aria-hidden="true" />
          <span className="min-w-0 truncate">{timesheetEventMessage(notification)}</span>
        </button>
      )}
    </div>
  );
}
