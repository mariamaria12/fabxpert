/** Combine today's calendar date with an HH:mm time string. */
export function combineTodayWithTime(time: string): Date | null {
  if (!time) {
    return null;
  }

  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!match) {
    return null;
  }

  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);

  if (hours > 23 || minutes > 59) {
    return null;
  }

  const date = new Date();
  date.setSeconds(0, 0);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

export function formatDurationMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

/** Build a closed interval ending now with the given duration in hours. */
export function intervalEndingNow(
  hours: number,
): { startTime: Date; endTime: Date } | null {
  if (!Number.isFinite(hours) || hours <= 0) {
    return null;
  }

  const endTime = new Date();
  endTime.setSeconds(0, 0);
  endTime.setMilliseconds(0);

  const startTime = new Date(endTime.getTime() - hours * 60 * 60 * 1000);
  return { startTime, endTime };
}

/** Parse a free-form hours value (supports "4", "4.5", "4,5"). */
export function parseHoursInput(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (normalized === '') {
    return null;
  }

  const hours = Number.parseFloat(normalized);
  if (!Number.isFinite(hours) || hours <= 0) {
    return null;
  }

  return hours;
}

export function formatHoursDisplay(hours: number): string {
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1).replace(/\.0$/, '');
}

export function formatClockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ro-RO', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatElapsedHms(fromIso: string, now: Date = new Date()): string {
  const startMs = new Date(fromIso).getTime();
  const elapsedSec = Math.max(0, Math.floor((now.getTime() - startMs) / 1000));
  const hours = Math.floor(elapsedSec / 3600);
  const minutes = Math.floor((elapsedSec % 3600) / 60);
  const seconds = elapsedSec % 60;

  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
}

export interface TimesheetDurationEntry {
  startTime: string;
  endTime: string | null;
}

export function isSameLocalCalendarDay(iso: string, reference = new Date()): boolean {
  const date = new Date(iso);
  return (
    date.getFullYear() === reference.getFullYear() &&
    date.getMonth() === reference.getMonth() &&
    date.getDate() === reference.getDate()
  );
}

/** Sum closed entry durations (minutes, rounded) for entries starting today (local time). */
export function sumTodayClosedMinutes(
  entries: TimesheetDurationEntry[],
  reference = new Date(),
): number {
  let totalMs = 0;

  for (const entry of entries) {
    if (entry.endTime === null) {
      continue;
    }
    if (!isSameLocalCalendarDay(entry.startTime, reference)) {
      continue;
    }

    totalMs +=
      new Date(entry.endTime).getTime() - new Date(entry.startTime).getTime();
  }

  return Math.round(totalMs / 60000);
}

/** Banner label: "8h" or "7h 30m" (nearest minute). */
export function formatTodayWorkedTotal(totalMinutes: number): string {
  return formatDurationMinutes(totalMinutes);
}

export function getLocalDayKeyFromDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth()).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function getLocalDayKey(iso: string): string {
  return getLocalDayKeyFromDate(new Date(iso));
}

export function parseLocalDayKey(dayKey: string): Date {
  const [year, month, day] = dayKey.split('-').map(Number);
  return new Date(year, month, day);
}

export function entryDurationMinutes(entry: TimesheetDurationEntry): number | null {
  if (entry.endTime === null) {
    return null;
  }

  return Math.round(
    (new Date(entry.endTime).getTime() - new Date(entry.startTime).getTime()) / 60000,
  );
}

export function sumDayClosedMinutes(entries: TimesheetDurationEntry[]): number {
  let totalMinutes = 0;

  for (const entry of entries) {
    const minutes = entryDurationMinutes(entry);
    if (minutes !== null) {
      totalMinutes += minutes;
    }
  }

  return totalMinutes;
}

export function hoursFromEntryDuration(entry: TimesheetDurationEntry): number | null {
  const minutes = entryDurationMinutes(entry);
  if (minutes === null) {
    return null;
  }

  return Math.round(minutes / 30) / 2;
}

export function endTimeFromStartAndHours(startTime: Date | string, hours: number): Date {
  const start = new Date(startTime);
  return new Date(start.getTime() + hours * 60 * 60 * 1000);
}

export function formatDayGroupHeader(
  dayKey: string,
  reference = new Date(),
): { label: string; isToday: boolean } {
  const date = parseLocalDayKey(dayKey);
  const isToday = getLocalDayKeyFromDate(reference) === dayKey;
  const weekday = date.toLocaleDateString('ro-RO', { weekday: 'long' });
  const day = date.getDate();
  const month = date.toLocaleDateString('ro-RO', { month: 'short' }).replace('.', '');

  if (isToday) {
    return { label: `AZI · ${weekday}, ${day} ${month}`, isToday: true };
  }

  return {
    label: `${weekday.toUpperCase()}, ${day} ${month.toUpperCase()}`,
    isToday: false,
  };
}

export function groupEntriesByLocalDay<T extends TimesheetDurationEntry>(
  entries: T[],
  reference = new Date(),
): { dayKey: string; entries: T[] }[] {
  const groups = new Map<string, T[]>();

  for (const entry of entries) {
    const dayKey = getLocalDayKey(entry.startTime);
    const dayEntries = groups.get(dayKey) ?? [];
    dayEntries.push(entry);
    groups.set(dayKey, dayEntries);
  }

  const todayKey = getLocalDayKeyFromDate(reference);

  return Array.from(groups.entries())
    .sort(([leftKey], [rightKey]) => {
      if (leftKey === todayKey) {
        return -1;
      }
      if (rightKey === todayKey) {
        return 1;
      }
      return rightKey.localeCompare(leftKey);
    })
    .map(([dayKey, dayEntries]) => ({ dayKey, entries: dayEntries }));
}

export function isEditableTodayEntry(
  entry: TimesheetDurationEntry,
  reference = new Date(),
): boolean {
  return entry.endTime !== null && isSameLocalCalendarDay(entry.startTime, reference);
}
