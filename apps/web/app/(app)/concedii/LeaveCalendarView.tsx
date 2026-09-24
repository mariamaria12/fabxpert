'use client';

import {
  listLeaveRequests,
  type LeaveRequestDto,
  type LeaveStatus,
  type LeaveType,
} from '@fabxpert/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarView } from '@/components/calendar/CalendarView';
import { useCalendarState } from '@/components/calendar/useCalendarState';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';
import { loadAllPages } from '@/utils/loadAllPages';
import { leaveItemsByDay, LeaveTypeLegend } from './leaveCalendarItems';

interface LeaveCalendarViewProps {
  status: LeaveStatus | null;
  type: LeaveType | null;
  personId: string | null;
  refreshToken: number;
  onOpen: (request: LeaveRequestDto) => void;
}

/** Leave by week, month or year, one chip per person per day, coloured by type. */
export function LeaveCalendarView({
  status,
  type,
  personId,
  refreshToken,
  onOpen,
}: LeaveCalendarViewProps) {
  const calendar = useCalendarState('leave-requests');
  const { from, to, days } = calendar.range;
  const [requests, setRequests] = useState<LeaveRequestDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const rows = await loadAllPages((page, pageSize) =>
        listLeaveRequests({
          page,
          pageSize,
          from,
          to,
          ...(status ? { status } : {}),
          ...(type ? { type } : {}),
          ...(personId ? { personId } : {}),
        }),
      );
      setRequests(rows);
    } catch (caught) {
      setError(apiErrorToastMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [from, to, status, type, personId]);

  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  const itemsByDay = useMemo(() => {
    const byDay = leaveItemsByDay(requests, days, onOpen);
    for (const items of byDay.values()) {
      items.sort((a, b) => a.sortKey.localeCompare(b.sortKey, 'ro'));
    }
    return byDay;
  }, [requests, days, onOpen]);

  function dayMarker(dayKey: string) {
    const items = itemsByDay.get(dayKey);
    if (!items?.length) {
      return null;
    }
    return {
      color: items[0].color,
      title: items.length === 1 ? '1 persoană în concediu' : `${items.length} persoane în concediu`,
    };
  }

  return (
    <div>
      {error ? (
        <div className="mb-4 flex items-center justify-between gap-4 rounded-md border border-border-subtle bg-[var(--color-toast-error-bg)] px-4 py-3">
          <p className="text-sm text-danger">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="shrink-0 rounded-md border border-border px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
          >
            Reîncearcă
          </button>
        </div>
      ) : null}

      <CalendarView
        state={calendar}
        loading={loading}
        itemsByDay={itemsByDay}
        dayMarker={dayMarker}
        emptyMessage="Niciun concediu în această perioadă."
        legend={<LeaveTypeLegend />}
      />
    </div>
  );
}
