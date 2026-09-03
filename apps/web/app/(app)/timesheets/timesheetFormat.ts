import type { TimesheetDto } from '@fabxpert/shared';
import { formatDateDisplay, workDateToDayKey } from '@fabxpert/shared';

/** Payroll export format: NUME PRENUME (uppercase). */
export function formatExportWorkerName(person: { firstName: string; lastName: string }): string {
  return `${person.lastName} ${person.firstName}`.trim().toUpperCase();
}

export function personFullName(timesheet: TimesheetDto): string {
  return `${timesheet.person.firstName} ${timesheet.person.lastName}`;
}

export function formatProjectLabel(timesheet: TimesheetDto): string | null {
  const { name, code } = timesheet.project;
  if (!name && !code) {
    return null;
  }
  if (name && code) {
    return `${name} · ${code}`;
  }
  return name || code;
}

const PLAIN_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * workDate is stored at server-local midnight and sent as a UTC timestamp, so
 * the date part of the ISO string can be the day before. Read the local
 * calendar day — the one the grouping and the edit form already use.
 */
export function formatRomanianDate(iso: string): string {
  const trimmed = iso.trim();
  return formatDateDisplay(PLAIN_DATE_PATTERN.test(trimmed) ? trimmed : workDateToDayKey(trimmed));
}

/** One mark and the pieces it carries on a pontaj: "GBAL/25 ×2". */
export function formatAssemblyChip(link: { name: string; quantityDone: number }): string {
  return `${link.name} ×${link.quantityDone}`;
}

/** Pieces and distinct marks a day's entries closed. */
export function summarizeDayAssemblies(entries: TimesheetDto[]): {
  pieces: number;
  marks: number;
} {
  const marks = new Set<string>();
  let pieces = 0;

  for (const entry of entries) {
    for (const link of entry.assemblies) {
      marks.add(link.assemblyId);
      pieces += link.quantityDone;
    }
  }

  return { pieces, marks: marks.size };
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

export function formatTimesheetDuration(timesheet: TimesheetDto): string {
  return formatDurationMinutes(timesheet.durationMinutes);
}

/** Decimal hours as in the Excel export (Nr. ORE LUCRATE). */
export function formatExportHours(durationMinutes: number): string {
  const hours = durationMinutes / 60;
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}

export function workDateMonthNumber(iso: string): number {
  return new Date(iso).getMonth() + 1;
}

export function getLocalDayKey(iso: string): string {
  return workDateToDayKey(iso);
}

export function isoToDateInput(iso: string): string {
  return getLocalDayKey(iso);
}

export function durationMinutesToHoursInput(durationMinutes: number): string {
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h${minutes}m`;
}

/**
 * Accepted duration inputs: `9h`, `1h30`, `1h30m`, `1h 30`, `45m`, `8`, `7.5`.
 * A trailing `m` is optional so `1h30` isn't silently read as one hour.
 */
export function parseDurationMinutesInput(value: string): number | null {
  const trimmed = value.trim().toLowerCase();
  if (trimmed === '') {
    return null;
  }

  const hoursMinutesMatch = /^(\d+)\s*h\s*(?:(\d+)\s*m?)?$/.exec(trimmed);
  if (hoursMinutesMatch) {
    const hours = Number.parseInt(hoursMinutesMatch[1], 10);
    const minutes = hoursMinutesMatch[2] ? Number.parseInt(hoursMinutesMatch[2], 10) : 0;

    if (minutes < 0 || minutes >= 60 || (hours === 0 && minutes === 0)) {
      return null;
    }

    return hours * 60 + minutes;
  }

  const minutesOnlyMatch = /^(\d+)\s*m$/.exec(trimmed);
  if (minutesOnlyMatch) {
    const minutes = Number.parseInt(minutesOnlyMatch[1], 10);
    if (minutes <= 0) {
      return null;
    }

    return minutes;
  }

  // Plain hours only — anything else would be a partial parse ("1x30" → 1h).
  const decimalInput = trimmed.replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(decimalInput)) {
    return null;
  }

  const decimalHours = Number.parseFloat(decimalInput);
  if (Number.isFinite(decimalHours) && decimalHours > 0) {
    return Math.round(decimalHours * 60);
  }

  return null;
}
