'use client';

import {
  getTimesheetCalendarDays,
  getTimesheetDailyTotals,
  listLeaveRequests,
  listTimesheetDayGroups,
  type LeaveRequestDto,
  type TimesheetCalendarDayDto,
  type TimesheetDailyTotalDto,
  type TimesheetDayGroupDto,
} from '@fabxpert/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarView, type CalendarItem } from '@/components/calendar/CalendarView';
import { useCalendarState } from '@/components/calendar/useCalendarState';
import { useToast } from '@/context/ToastContext';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';
import { loadAllPages } from '@/utils/loadAllPages';
import {
  leaveItemsByDay,
  LeaveTypeLegend,
  personSortKey,
  shortPersonName,
} from '../concedii/leaveCalendarItems';
import { formatDurationMinutes } from './timesheetFormat';

const PONTAJ_COLOR = 'var(--color-accent)';

/** Lowercase, without diacritics, so "stefan" finds "Ștefan". */
function foldText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function matchesSearch(person: { firstName: string; lastName: string }, search: string): boolean {
  if (!search) {
    return true;
  }
  const needle = foldText(search);
  return (
    foldText(`${person.firstName} ${person.lastName}`).includes(needle) ||
    foldText(`${person.lastName} ${person.firstName}`).includes(needle)
  );
}

function TimesheetDayChip({
  day,
  opening,
  onOpen,
}: {
  day: TimesheetCalendarDayDto;
  opening: boolean;
  onOpen: (day: TimesheetCalendarDayDto) => void;
}) {
  return (
    <button
      type="button"
      disabled={opening}
      onClick={() => onOpen(day)}
      title={`${day.person.firstName} ${day.person.lastName} — ${formatDurationMinutes(day.totalMinutes)}, ${
        day.entryCount === 1 ? '1 pontaj' : `${day.entryCount} pontaje`
      }`}
      className="flex w-full min-w-0 items-center gap-1 rounded border border-border-subtle bg-surface-raised px-1.5 py-0.5 text-left text-[11px] leading-4 text-text-primary transition-colors hover:border-border disabled:opacity-60"
    >
      {/* The day's main activity colours the dot, as the list's activity totals do. */}
      <span
        className="size-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: day.activityColor ?? 'var(--color-text-muted)' }}
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1 truncate font-medium">{shortPersonName(day.person)}</span>
      <span className="shrink-0 tabular-nums text-text-secondary">
        {opening ? (
          <i className="ti ti-loader-2 animate-spin text-[11px]" aria-hidden="true" />
        ) : (
          formatDurationMinutes(day.totalMinutes)
        )}
      </span>
    </button>
  );
}

interface TimesheetCalendarViewProps {
  search: string;
  refreshToken: number;
  onOpenDay: (group: TimesheetDayGroupDto) => void;
  onOpenLeave: (request: LeaveRequestDto) => void;
}

/**
 * Pontaje and leave together, by week, month or year: who logged how much each
 * day, and who was off. Rejected leave is left out; pending leave is dashed.
 * Only totals are loaded; a day's entries are fetched when its chip is opened.
 */
export function TimesheetCalendarView({
  search,
  refreshToken,
  onOpenDay,
  onOpenLeave,
}: TimesheetCalendarViewProps) {
  const { showToast } = useToast();
  const calendar = useCalendarState('timesheets');
  const { mode } = calendar;
  const { from, to, days } = calendar.range;
  const [personDays, setPersonDays] = useState<TimesheetCalendarDayDto[]>([]);
  const [openingKey, setOpeningKey] = useState<string | null>(null);
  const [yearTotals, setYearTotals] = useState<TimesheetDailyTotalDto[]>([]);
  const [leave, setLeave] = useState<LeaveRequestDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const period = { kind: 'custom' as const, from, to };

    try {
      const leavePromise = loadAllPages((page, pageSize) =>
        listLeaveRequests({ page, pageSize, from, to }),
      );

      if (mode === 'year') {
        const [totals, leaveRows] = await Promise.all([
          getTimesheetDailyTotals({ period, ...(search ? { search } : {}) }),
          leavePromise,
        ]);
        setYearTotals(totals.days);
        setPersonDays([]);
        setLeave(leaveRows.filter((request) => request.status !== 'RESPINS'));
      } else {
        const [calendarDays, leaveRows] = await Promise.all([
          getTimesheetCalendarDays({ period, ...(search ? { search } : {}) }),
          leavePromise,
        ]);
        setPersonDays(calendarDays.days);
        setYearTotals([]);
        setLeave(leaveRows.filter((request) => request.status !== 'RESPINS'));
      }
    } catch (caught) {
      setError(apiErrorToastMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [mode, from, to, search]);

  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  // The panel edits whole entries, so the day is loaded in full only now.
  const openDay = useCallback(
    async (day: TimesheetCalendarDayDto) => {
      const key = `${day.person.id}:${day.workDate}`;
      setOpeningKey(key);
      try {
        const response = await listTimesheetDayGroups({
          personId: day.person.id,
          period: { kind: 'custom', from: day.workDate, to: day.workDate },
          pageSize: 1,
        });
        const group = response.data[0];
        if (group) {
          onOpenDay(group);
        } else {
          showToast('Pontajul acestei zile nu mai există.', 'error');
          void load();
        }
      } catch (caught) {
        showToast(apiErrorToastMessage(caught), 'error');
      } finally {
        setOpeningKey(null);
      }
    },
    [onOpenDay, showToast, load],
  );

  const visibleLeave = useMemo(
    () => leave.filter((request) => matchesSearch(request.person, search)),
    [leave, search],
  );

  const itemsByDay = useMemo(() => {
    const byDay = new Map<string, (CalendarItem & { sortKey: string })[]>();

    for (const day of personDays) {
      const items = byDay.get(day.workDate) ?? [];
      const chipKey = `${day.person.id}:${day.workDate}`;
      items.push({
        key: `day-${chipKey}`,
        sortKey: personSortKey(day.person),
        color: day.activityColor ?? PONTAJ_COLOR,
        node: (
          <TimesheetDayChip
            day={day}
            opening={openingKey === chipKey}
            onOpen={(target) => void openDay(target)}
          />
        ),
      });
      byDay.set(day.workDate, items);
    }

    for (const [key, leaveItems] of leaveItemsByDay(visibleLeave, days, onOpenLeave)) {
      byDay.set(key, [...(byDay.get(key) ?? []), ...leaveItems]);
    }

    // One person per line, whichever kind of chip they have.
    for (const items of byDay.values()) {
      items.sort((a, b) => a.sortKey.localeCompare(b.sortKey, 'ro'));
    }
    return byDay;
  }, [personDays, visibleLeave, days, openingKey, openDay, onOpenLeave]);

  /** People who logged and minutes, per day — from the groups, or the year's totals. */
  const totalsByDay = useMemo(() => {
    const totals = new Map<string, { people: number; minutes: number }>();
    for (const day of yearTotals) {
      totals.set(day.date, { people: day.people, minutes: day.minutes });
    }
    for (const day of personDays) {
      const current = totals.get(day.workDate) ?? { people: 0, minutes: 0 };
      totals.set(day.workDate, {
        people: current.people + 1,
        minutes: current.minutes + day.totalMinutes,
      });
    }
    return totals;
  }, [personDays, yearTotals]);

  const leaveCountByDay = useMemo(() => {
    const counts = new Map<string, number>();
    for (const [key, items] of leaveItemsByDay(visibleLeave, days, onOpenLeave)) {
      counts.set(key, items.length);
    }
    return counts;
  }, [visibleLeave, days, onOpenLeave]);

  function daySummary(dayKey: string) {
    const totals = totalsByDay.get(dayKey);
    if (!totals) {
      return null;
    }
    return (
      <span
        title={`${totals.people} ${totals.people === 1 ? 'persoană a pontat' : 'persoane au pontat'}`}
      >
        <i className="ti ti-users text-[11px]" aria-hidden="true" /> {totals.people} ·{' '}
        {formatDurationMinutes(totals.minutes)}
      </span>
    );
  }

  function dayMarker(dayKey: string) {
    const totals = totalsByDay.get(dayKey);
    const onLeave = leaveCountByDay.get(dayKey) ?? 0;
    if (!totals && onLeave === 0) {
      return null;
    }

    const parts: string[] = [];
    if (totals) {
      parts.push(
        `${totals.people} ${totals.people === 1 ? 'persoană' : 'persoane'} · ${formatDurationMinutes(totals.minutes)}`,
      );
    }
    if (onLeave > 0) {
      parts.push(`${onLeave} în concediu`);
    }
    return {
      color: totals ? PONTAJ_COLOR : (itemsByDay.get(dayKey)?.[0]?.color ?? PONTAJ_COLOR),
      title: parts.join(' · '),
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
        daySummary={daySummary}
        dayMarker={dayMarker}
        chipsPerDay={6}
        emptyMessage="Niciun pontaj sau concediu în această perioadă."
        legend={
          <>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="inline-block size-2.5 rounded-sm border border-border-subtle bg-surface-raised"
                aria-hidden="true"
              />
              Pontaj (ore pe zi)
            </span>
            <LeaveTypeLegend />
          </>
        }
      />
    </div>
  );
}
