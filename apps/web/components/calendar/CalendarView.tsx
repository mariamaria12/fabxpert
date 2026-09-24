'use client';

import { isWorkingDate, workDateToDayKey } from '@fabxpert/shared';
import { useEffect, useState, type ReactNode } from 'react';
import { useIsMobile } from '@/hooks/useIsMobile';
import { startOfWeek, type CalendarMode, type CalendarState } from './useCalendarState';

const WEEKDAYS = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică'];
const WEEKDAYS_SHORT = ['Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm', 'Dum'];
const WEEKDAY_LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const MODE_OPTIONS: { id: CalendarMode; label: string }[] = [
  { id: 'week', label: 'Săptămână' },
  { id: 'month', label: 'Lună' },
  { id: 'year', label: 'An' },
];

/** Bars drawn in a phone's month cell before the rest become "+N". */
const MOBILE_BARS_PER_DAY = 3;

/** One chip in a day. `color` draws it where there is no room for text. */
export type CalendarItem = { key: string; node: ReactNode; color: string };

/** A day in the year view: tinted when something happened, with a tooltip. */
export type CalendarDayMarker = { color: string; title: string };

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function monthTitle(date: Date): string {
  return capitalize(date.toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' }));
}

function title(mode: CalendarMode, anchor: Date): string {
  if (mode === 'year') {
    return String(anchor.getFullYear());
  }
  if (mode === 'month') {
    return monthTitle(anchor);
  }

  const first = startOfWeek(anchor);
  const last = new Date(first.getFullYear(), first.getMonth(), first.getDate() + 6);
  const sameMonth = first.getMonth() === last.getMonth();
  const start = first.toLocaleDateString('ro-RO', {
    day: 'numeric',
    ...(sameMonth ? {} : { month: 'short' }),
    ...(first.getFullYear() !== last.getFullYear() ? { year: 'numeric' } : {}),
  });
  const end = last.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${start} – ${end}`;
}

/** `month`'s days, Monday first, padded with nulls to whole weeks. */
function monthCells(month: Date): (Date | null)[] {
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const leading = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7;

  const cells: (Date | null)[] = Array.from({ length: leading }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(month.getFullYear(), month.getMonth(), day));
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  return cells;
}

function tint(color: string, amount: string): string {
  return `color-mix(in srgb, ${color} ${amount}, transparent)`;
}

interface CalendarViewProps {
  state: CalendarState;
  loading?: boolean;
  /** Chips per day, keyed by `YYYY-MM-DD`. */
  itemsByDay: Map<string, CalendarItem[]>;
  /** A short line at the top of a day, e.g. its totals. */
  daySummary?: (dayKey: string) => ReactNode;
  /** How a day reads in the year view. Defaults to its first chip's colour. */
  dayMarker?: (dayKey: string) => CalendarDayMarker | null;
  /** Chips shown in a month cell before the rest fold into "+N". */
  chipsPerDay?: number;
  emptyMessage: string;
  legend?: ReactNode;
}

/**
 * A calendar in the manner of Google Calendar: week, month and year views,
 * with "Azi" and arrows to move. On a phone the month keeps its grid with
 * coloured bars, and the day tapped lists its chips underneath.
 */
export function CalendarView({
  state,
  loading = false,
  itemsByDay,
  daySummary,
  dayMarker,
  chipsPerDay = 4,
  emptyMessage,
  legend,
}: CalendarViewProps) {
  const { mode, setMode, anchor, setAnchor, range, shift, goToday } = state;
  const isMobile = useIsMobile();
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const todayKey = workDateToDayKey(new Date());

  useEffect(() => {
    setExpandedDay(null);
  }, [range.from]);

  // A phone's month lists one day under the grid: today when it is in view.
  const activeDay =
    selectedDay && selectedDay >= range.from && selectedDay <= range.to
      ? selectedDay
      : todayKey >= range.from && todayKey <= range.to
        ? todayKey
        : range.from;

  function markerFor(key: string): CalendarDayMarker | null {
    if (dayMarker) {
      return dayMarker(key);
    }
    const items = itemsByDay.get(key) ?? [];
    return items.length > 0 ? { color: items[0].color, title: `${items.length}` } : null;
  }

  function openMonthAt(day: Date) {
    setAnchor(day);
    setSelectedDay(workDateToDayKey(day));
    setMode('month');
  }

  function dayNumber(day: Date, key: string, size = 'size-6 text-xs') {
    const offDay = !isWorkingDate(day);
    return (
      <span
        className={`flex ${size} shrink-0 items-center justify-center rounded-full tabular-nums ${
          key === todayKey
            ? 'bg-accent font-medium text-accent-contrast'
            : offDay
              ? 'text-text-muted'
              : 'text-text-secondary'
        }`}
      >
        {day.getDate()}
      </span>
    );
  }

  function renderChips(key: string, collapse: boolean) {
    const items = itemsByDay.get(key) ?? [];
    const expanded = !collapse || expandedDay === key;
    const shown = expanded ? items : items.slice(0, chipsPerDay);
    const hidden = items.length - shown.length;

    return (
      <div className="flex flex-col gap-0.5">
        {shown.map((item) => (
          <div key={item.key} className="min-w-0">
            {item.node}
          </div>
        ))}
        {hidden > 0 ? (
          <button
            type="button"
            onClick={() => setExpandedDay(key)}
            className="rounded px-1.5 text-left text-[11px] font-medium text-text-muted hover:text-text-primary"
          >
            +{hidden} {hidden === 1 ? 'altul' : 'alții'}
          </button>
        ) : null}
        {collapse && expandedDay === key && items.length > chipsPerDay ? (
          <button
            type="button"
            onClick={() => setExpandedDay(null)}
            className="rounded px-1.5 text-left text-[11px] font-medium text-text-muted hover:text-text-primary"
          >
            Mai puțin
          </button>
        ) : null}
      </div>
    );
  }

  function renderDayList(day: Date) {
    const key = workDateToDayKey(day);
    const items = itemsByDay.get(key) ?? [];
    return (
      <div key={key} className="rounded-lg border border-border-subtle p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {dayNumber(day, key, 'size-7 text-sm')}
            <span className="text-xs font-medium capitalize text-text-secondary">
              {day.toLocaleDateString('ro-RO', { weekday: 'long', month: 'long' })}
            </span>
          </div>
          {daySummary ? (
            <span className="text-[11px] text-text-muted">{daySummary(key)}</span>
          ) : null}
        </div>
        {items.length > 0 ? (
          renderChips(key, false)
        ) : (
          <p className="text-xs text-text-muted">Nimic în această zi.</p>
        )}
      </div>
    );
  }

  function renderMonth() {
    const cells = monthCells(anchor);

    if (isMobile) {
      const selected = range.days.find((day) => workDateToDayKey(day) === activeDay);
      return (
        <>
          <div className="mt-3 overflow-hidden rounded-lg border border-border-subtle">
            <div className="grid grid-cols-7 border-b border-border-subtle bg-surface-subtle">
              {WEEKDAY_LETTERS.map((letter, index) => (
                <div
                  key={index}
                  className="py-1 text-center text-[11px] font-medium text-text-muted"
                >
                  {letter}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {cells.map((day, index) => {
                const border = `border-b border-border-subtle ${index % 7 === 6 ? '' : 'border-r'}`;
                if (!day) {
                  return (
                    <div key={`blank-${index}`} className={`${border} bg-surface-sunken/40`} />
                  );
                }
                const key = workDateToDayKey(day);
                const items = itemsByDay.get(key) ?? [];
                const bars = items.slice(0, MOBILE_BARS_PER_DAY);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedDay(key)}
                    aria-pressed={key === activeDay}
                    className={`${border} flex min-h-[4rem] min-w-0 flex-col items-center gap-0.5 px-0.5 pt-1 pb-1 ${
                      key === activeDay
                        ? 'bg-accent/10'
                        : !isWorkingDate(day)
                          ? 'bg-surface-sunken/40'
                          : ''
                    }`}
                  >
                    {dayNumber(day, key)}
                    {bars.map((item) => (
                      <span
                        key={item.key}
                        className="h-1 w-full rounded-full"
                        style={{ backgroundColor: item.color }}
                        aria-hidden="true"
                      />
                    ))}
                    {items.length > bars.length ? (
                      <span className="text-[9px] leading-none text-text-muted">
                        +{items.length - bars.length}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
          {selected ? <div className="mt-3">{renderDayList(selected)}</div> : null}
        </>
      );
    }

    return (
      <div className="mt-3 overflow-hidden rounded-lg border border-border-subtle">
        <div className="grid grid-cols-7 border-b border-border-subtle bg-surface-subtle">
          {WEEKDAYS.map((weekday) => (
            <div key={weekday} className="px-2 py-1.5 text-xs font-medium text-text-muted">
              {weekday}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((day, index) => {
            const border = `border-b border-border-subtle ${index % 7 === 6 ? '' : 'border-r'}`;
            if (!day) {
              return <div key={`blank-${index}`} className={`${border} bg-surface-sunken/40`} />;
            }
            const key = workDateToDayKey(day);
            return (
              <div
                key={key}
                className={`${border} min-h-[6.5rem] min-w-0 p-1.5 ${
                  isWorkingDate(day) ? '' : 'bg-surface-sunken/40'
                }`}
              >
                <div className="mb-1 flex items-center justify-between gap-1">
                  <span className="truncate text-[11px] text-text-muted">
                    {daySummary ? daySummary(key) : null}
                  </span>
                  {dayNumber(day, key)}
                </div>
                {renderChips(key, true)}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function renderWeek() {
    if (isMobile) {
      return <div className="mt-3 flex flex-col gap-3">{range.days.map(renderDayList)}</div>;
    }

    return (
      <div className="mt-3 overflow-hidden rounded-lg border border-border-subtle">
        <div className="grid grid-cols-7">
          {range.days.map((day, index) => {
            const key = workDateToDayKey(day);
            return (
              <div
                key={key}
                className={`flex min-w-0 flex-col ${index === 6 ? '' : 'border-r border-border-subtle'} ${
                  isWorkingDate(day) ? '' : 'bg-surface-sunken/40'
                }`}
              >
                <div className="flex flex-col items-center gap-0.5 border-b border-border-subtle py-2">
                  <span
                    className={`text-[11px] font-medium uppercase ${
                      key === todayKey ? 'text-accent' : 'text-text-muted'
                    }`}
                  >
                    {WEEKDAYS_SHORT[index]}
                  </span>
                  {dayNumber(day, key, 'size-9 text-lg')}
                  <span className="h-4 truncate text-[11px] text-text-muted">
                    {daySummary ? daySummary(key) : null}
                  </span>
                </div>
                <div className="min-h-[24rem] p-1.5">{renderChips(key, false)}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function renderYear() {
    return (
      <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 12 }, (_, monthIndex) => {
          const month = new Date(anchor.getFullYear(), monthIndex, 1);
          return (
            <div key={monthIndex}>
              <button
                type="button"
                onClick={() => openMonthAt(month)}
                className="mb-1.5 text-sm font-medium text-text-primary hover:text-accent"
              >
                {capitalize(month.toLocaleDateString('ro-RO', { month: 'long' }))}
              </button>
              <div className="grid grid-cols-7 gap-y-0.5 text-center">
                {WEEKDAY_LETTERS.map((letter, index) => (
                  <span key={index} className="text-[10px] font-medium text-text-muted">
                    {letter}
                  </span>
                ))}
                {monthCells(month).map((day, index) => {
                  if (!day) {
                    return <span key={`blank-${index}`} />;
                  }
                  const key = workDateToDayKey(day);
                  const marker = markerFor(key);
                  const isToday = key === todayKey;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => openMonthAt(day)}
                      title={marker?.title}
                      style={
                        marker && !isToday
                          ? { backgroundColor: tint(marker.color, '30%') }
                          : undefined
                      }
                      className={`mx-auto flex size-7 items-center justify-center rounded-full text-[11px] tabular-nums transition-colors hover:ring-1 hover:ring-border ${
                        isToday
                          ? 'bg-accent font-medium text-accent-contrast'
                          : marker
                            ? 'font-medium text-text-primary'
                            : isWorkingDate(day)
                              ? 'text-text-secondary'
                              : 'text-text-muted'
                      }`}
                    >
                      {day.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  const hasAnything = range.days.some((day) => {
    const key = workDateToDayKey(day);
    return mode === 'year' ? markerFor(key) !== null : (itemsByDay.get(key)?.length ?? 0) > 0;
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1">
          <button
            type="button"
            onClick={goToday}
            className="mr-1 rounded-md border border-border px-3 py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
          >
            Azi
          </button>
          <button
            type="button"
            aria-label="Înapoi"
            onClick={() => shift(-1)}
            className="flex size-8 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
          >
            <i className="ti ti-chevron-left text-base" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Înainte"
            onClick={() => shift(1)}
            className="flex size-8 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
          >
            <i className="ti ti-chevron-right text-base" aria-hidden="true" />
          </button>
          <h2 className="ml-1 truncate text-base font-medium text-text-primary sm:text-lg">
            {title(mode, anchor)}
          </h2>
          {loading ? (
            <i
              className="ti ti-loader-2 ml-1 animate-spin text-base text-text-muted"
              aria-hidden="true"
            />
          ) : null}
        </div>

        <div
          role="group"
          aria-label="Perioadă calendar"
          className="inline-flex rounded-md border border-border p-0.5"
        >
          {MODE_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={mode === option.id}
              onClick={() => setMode(option.id)}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                mode === option.id
                  ? 'bg-surface-raised text-text-primary'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {mode === 'month' ? renderMonth() : mode === 'week' ? renderWeek() : renderYear()}

      {!loading && !hasAnything ? (
        <p className="mt-3 text-sm text-text-muted">{emptyMessage}</p>
      ) : null}

      {legend ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-text-muted">
          {legend}
        </div>
      ) : null}
    </div>
  );
}
