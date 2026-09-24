'use client';

import { useState } from 'react';

const WEEKDAYS = ['L', 'Ma', 'Mi', 'J', 'V', 'S', 'D'];

export interface DateRangeCalendarProps {
  /** Selected start as `YYYY-MM-DD`, or '' for none. */
  from: string;
  /** Selected end as `YYYY-MM-DD`, or '' for none. */
  to: string;
  /** Called once both ends are picked, earliest first. */
  onSelect: (from: string, to: string) => void;
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseDayKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function monthLabel(month: Date): string {
  const label = month.toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** The month's days, Monday first, padded with nulls to whole weeks. */
function monthGrid(month: Date): (Date | null)[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const leading = (first.getDay() + 6) % 7;

  const cells: (Date | null)[] = Array.from({ length: leading }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(month.getFullYear(), month.getMonth(), day));
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  return cells;
}

/**
 * One calendar for a whole range: the first click picks the start, the second
 * the end. Clicking the same day twice picks that single day.
 */
export function DateRangeCalendar({ from, to, onSelect }: DateRangeCalendarProps) {
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const shown = from ? parseDayKey(from) : new Date();
    return new Date(shown.getFullYear(), shown.getMonth(), 1);
  });
  const [anchor, setAnchor] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  const today = dayKey(new Date());

  // While picking, the range runs from the first click to the hovered day.
  let rangeStart = from;
  let rangeEnd = to;
  if (anchor) {
    const other = hovered ?? anchor;
    [rangeStart, rangeEnd] = anchor <= other ? [anchor, other] : [other, anchor];
  }

  function pick(key: string) {
    if (!anchor) {
      setAnchor(key);
      return;
    }

    const [start, end] = anchor <= key ? [anchor, key] : [key, anchor];
    setAnchor(null);
    setHovered(null);
    onSelect(start, end);
  }

  function shiftMonth(delta: number) {
    setVisibleMonth(
      (current) => new Date(current.getFullYear(), current.getMonth() + delta, 1),
    );
  }

  return (
    <div className="w-[272px] select-none">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          aria-label="Luna anterioară"
          onClick={() => shiftMonth(-1)}
          className="flex size-8 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
        >
          <i className="ti ti-chevron-left text-base" aria-hidden="true" />
        </button>
        <span className="text-sm font-medium text-text-primary">{monthLabel(visibleMonth)}</span>
        <button
          type="button"
          aria-label="Luna următoare"
          onClick={() => shiftMonth(1)}
          className="flex size-8 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
        >
          <i className="ti ti-chevron-right text-base" aria-hidden="true" />
        </button>
      </div>

      <div className="grid grid-cols-7 text-center text-[11px] font-medium text-text-muted">
        {WEEKDAYS.map((weekday) => (
          <span key={weekday} className="py-1">
            {weekday}
          </span>
        ))}
      </div>

      <div
        className="grid grid-cols-7 gap-y-0.5"
        onMouseLeave={() => setHovered(null)}
      >
        {monthGrid(visibleMonth).map((date, index) => {
          if (!date) {
            return <span key={`blank-${index}`} />;
          }

          const key = dayKey(date);
          const isStart = key === rangeStart;
          const isEnd = key === rangeEnd;
          const isEdge = isStart || isEnd;
          const inRange = rangeStart !== '' && rangeEnd !== '' && key > rangeStart && key < rangeEnd;
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;

          // The band behind the days joins the two ends into one strip.
          const band =
            rangeStart !== rangeEnd && (inRange || isEdge)
              ? `bg-accent/15 ${isStart ? 'rounded-l-md' : ''} ${isEnd ? 'rounded-r-md' : ''}`
              : '';

          return (
            <div key={key} className={band}>
              <button
                type="button"
                aria-pressed={isEdge}
                aria-label={date.toLocaleDateString('ro-RO', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
                onClick={() => pick(key)}
                onMouseEnter={() => setHovered(key)}
                className={`flex h-9 w-full items-center justify-center rounded-md text-sm tabular-nums transition-colors ${
                  isEdge
                    ? 'bg-accent font-medium text-accent-contrast'
                    : `hover:bg-surface-raised ${
                        key === today
                          ? 'font-semibold text-accent'
                          : isWeekend
                            ? 'text-text-muted'
                            : 'text-text-primary'
                      }`
                }`}
              >
                {date.getDate()}
              </button>
            </div>
          );
        })}
      </div>

      <p className="mt-2 text-xs text-text-muted">
        {anchor
          ? 'Alege ultima zi a intervalului.'
          : 'Alege prima zi, apoi ultima. Pentru o singură zi, apasă-o de două ori.'}
      </p>
    </div>
  );
}
