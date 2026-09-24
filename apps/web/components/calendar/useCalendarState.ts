'use client';

import { workDateToDayKey } from '@fabxpert/shared';
import { useCallback, useMemo, useState } from 'react';
import { useViewPreference } from '@/hooks/useViewPreference';

export type CalendarMode = 'week' | 'month' | 'year';

export const CALENDAR_MODES: readonly CalendarMode[] = ['week', 'month', 'year'];

export type CalendarRange = {
  /** First day shown, `YYYY-MM-DD`. */
  from: string;
  /** Last day shown, `YYYY-MM-DD`, inclusive. */
  to: string;
  /** Every day in between, at local midnight. */
  days: Date[];
};

function today(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Monday of `date`'s week. */
export function startOfWeek(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

function rangeFor(mode: CalendarMode, anchor: Date): CalendarRange {
  let first: Date;
  let last: Date;
  if (mode === 'week') {
    first = startOfWeek(anchor);
    last = new Date(first.getFullYear(), first.getMonth(), first.getDate() + 6);
  } else if (mode === 'month') {
    first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  } else {
    first = new Date(anchor.getFullYear(), 0, 1);
    last = new Date(anchor.getFullYear(), 11, 31);
  }

  const days: Date[] = [];
  for (const cursor = new Date(first); cursor <= last; cursor.setDate(cursor.getDate() + 1)) {
    days.push(new Date(cursor));
  }

  return { from: workDateToDayKey(first), to: workDateToDayKey(last), days };
}

/**
 * Which slice of time a calendar shows: the view (week, month, year — kept per
 * user) and the day it is anchored on.
 */
export function useCalendarState(preferenceKey: string) {
  const [mode, setMode] = useViewPreference<CalendarMode>(
    `${preferenceKey}-calendar`,
    CALENDAR_MODES,
    'month',
  );
  const [anchor, setAnchor] = useState(today);
  const range = useMemo(() => rangeFor(mode, anchor), [mode, anchor]);

  const shift = useCallback(
    (delta: number) => {
      setAnchor((current) => {
        if (mode === 'week') {
          return new Date(current.getFullYear(), current.getMonth(), current.getDate() + 7 * delta);
        }
        if (mode === 'month') {
          return new Date(current.getFullYear(), current.getMonth() + delta, 1);
        }
        return new Date(current.getFullYear() + delta, current.getMonth(), 1);
      });
    },
    [mode],
  );

  const goToday = useCallback(() => setAnchor(today()), []);

  return { mode, setMode, anchor, setAnchor, range, shift, goToday };
}

export type CalendarState = ReturnType<typeof useCalendarState>;
