import { isSameWorkDate, workDateToDayKey } from '@fabxpert/shared';

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

export const DURATION_MINUTE_PRESETS = [15, 30, 45] as const;

export type DurationMinutePreset = 0 | (typeof DURATION_MINUTE_PRESETS)[number];

export function isDurationMinutePreset(value: number): value is DurationMinutePreset {
  return value === 0 || value === 15 || value === 30 || value === 45;
}

export function durationPartsFromTotalHours(totalHours: number): {
  hours: number;
  minutes: DurationMinutePreset;
} {
  const totalMinutes = Math.max(0, Math.round(totalHours * 60));
  const hours = Math.floor(totalMinutes / 60);
  const remainder = totalMinutes % 60;

  return {
    hours,
    minutes: isDurationMinutePreset(remainder) ? remainder : 0,
  };
}

export function hasFractionalHoursInput(value: string): boolean {
  const normalized = value.trim().replace(',', '.');
  if (!normalized.includes('.')) {
    return false;
  }

  const hours = Number.parseFloat(normalized);
  return Number.isFinite(hours) && !Number.isInteger(hours);
}

export function parseWholeHoursInput(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (normalized === '') {
    return null;
  }

  const hours = Number.parseFloat(normalized);
  if (!Number.isFinite(hours) || hours < 0 || !Number.isInteger(hours)) {
    return null;
  }

  return hours;
}

export function combineHoursAndMinutes(
  wholeHours: number,
  minutes: DurationMinutePreset,
): number {
  return wholeHours + minutes / 60;
}

export function formatDurationInputDisplay(
  wholeHours: number,
  minutes: DurationMinutePreset,
): string {
  if (wholeHours === 0 && minutes === 0) {
    return '';
  }

  if (wholeHours === 0) {
    return `${minutes}m`;
  }

  if (minutes === 0) {
    return `${wholeHours}h`;
  }

  return `${wholeHours}h${minutes}m`;
}

export function parseDurationInputParts(value: string): {
  hours: number;
  minutes: number;
} | null {
  const trimmed = value.trim().toLowerCase();
  if (trimmed === '') {
    return null;
  }

  const hoursMinutesMatch = /^(\d+)h(?:(\d+)m)?$/.exec(trimmed);
  if (hoursMinutesMatch) {
    const hours = Number.parseInt(hoursMinutesMatch[1], 10);
    const minutes = hoursMinutesMatch[2]
      ? Number.parseInt(hoursMinutesMatch[2], 10)
      : 0;

    if (minutes < 0 || minutes >= 60 || (hours === 0 && minutes === 0)) {
      return null;
    }

    return { hours, minutes };
  }

  const minutesOnlyMatch = /^(\d+)m$/.exec(trimmed);
  if (minutesOnlyMatch) {
    const minutes = Number.parseInt(minutesOnlyMatch[1], 10);
    if (minutes <= 0 || minutes >= 60) {
      return null;
    }

    return { hours: 0, minutes };
  }

  if (hasFractionalHoursInput(trimmed)) {
    const totalHours = parseHoursInput(trimmed);
    if (totalHours === null) {
      return null;
    }

    const totalMinutes = Math.round(totalHours * 60);
    return {
      hours: Math.floor(totalMinutes / 60),
      minutes: totalMinutes % 60,
    };
  }

  const wholeHours = parseWholeHoursInput(trimmed);
  if (wholeHours !== null && wholeHours > 0) {
    return { hours: wholeHours, minutes: 0 };
  }

  return null;
}

export function getWholeHoursFromInput(value: string): number {
  const parts = parseDurationInputParts(value);
  return parts?.hours ?? 0;
}

export function getPresetMinutesFromInput(value: string): DurationMinutePreset {
  const parts = parseDurationInputParts(value);
  if (parts && isDurationMinutePreset(parts.minutes)) {
    return parts.minutes;
  }

  return 0;
}

export function resolveDurationHours(
  hoursInput: string,
  selectedMinutes: DurationMinutePreset,
): number | null {
  const parts = parseDurationInputParts(hoursInput);
  if (parts) {
    const total = parts.hours + parts.minutes / 60;
    return total > 0 ? total : null;
  }

  if (selectedMinutes > 0) {
    return selectedMinutes / 60;
  }

  return null;
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
  workDate: string;
  durationMinutes: number;
}

/** Sum entry durations (minutes) for entries with workDate today (local calendar). */
export function sumTodayMinutes(
  entries: TimesheetDurationEntry[],
  reference = new Date(),
): number {
  let totalMinutes = 0;

  for (const entry of entries) {
    if (!isSameWorkDate(entry.workDate, reference)) {
      continue;
    }

    totalMinutes += entry.durationMinutes;
  }

  return totalMinutes;
}

/** @deprecated Use sumTodayMinutes */
export const sumTodayClosedMinutes = sumTodayMinutes;

/** Banner label: "8h" or "7h 30m" (nearest minute). */
export function formatTodayWorkedTotal(totalMinutes: number): string {
  return formatDurationMinutes(totalMinutes);
}

export function getLocalDayKeyFromDate(date: Date): string {
  return workDateToDayKey(date);
}

export function getLocalDayKey(iso: string): string {
  return workDateToDayKey(iso);
}

export function parseLocalDayKey(dayKey: string): Date {
  const [year, month, day] = dayKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function entryDurationMinutes(entry: TimesheetDurationEntry): number {
  return entry.durationMinutes;
}

export function sumDayMinutes(entries: TimesheetDurationEntry[]): number {
  let totalMinutes = 0;

  for (const entry of entries) {
    totalMinutes += entry.durationMinutes;
  }

  return totalMinutes;
}

/** @deprecated Use sumDayMinutes */
export const sumDayClosedMinutes = sumDayMinutes;

export function durationPartsFromEntry(
  entry: TimesheetDurationEntry,
): { hours: number; minutes: DurationMinutePreset } {
  return durationPartsFromTotalHours(entry.durationMinutes / 60);
}

export function hoursFromEntryDuration(entry: TimesheetDurationEntry): number {
  return Math.round(entry.durationMinutes / 30) / 2;
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

export function formatMobileTodayDate(reference = new Date()): string {
  const formatted = reference.toLocaleDateString('ro-RO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function groupEntriesByLocalDay<T extends TimesheetDurationEntry>(
  entries: T[],
  reference = new Date(),
): { dayKey: string; entries: T[] }[] {
  const groups = new Map<string, T[]>();

  for (const entry of entries) {
    const dayKey = getLocalDayKey(entry.workDate);
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
  return isSameWorkDate(entry.workDate, reference);
}
