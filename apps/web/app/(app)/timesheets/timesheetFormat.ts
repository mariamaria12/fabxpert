import type { TimesheetDto } from '@fabxpert/shared';
import { workDateToDayKey } from '@fabxpert/shared';

/** Payroll export format: NUME PRENUME (uppercase). */
export function formatExportWorkerName(person: {
  firstName: string;
  lastName: string;
}): string {
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

export function formatRomanianDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ro-RO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
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

export function parseDurationMinutesInput(value: string): number | null {
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

    return hours * 60 + minutes;
  }

  const minutesOnlyMatch = /^(\d+)m$/.exec(trimmed);
  if (minutesOnlyMatch) {
    const minutes = Number.parseInt(minutesOnlyMatch[1], 10);
    if (minutes <= 0) {
      return null;
    }

    return minutes;
  }

  const decimalHours = Number.parseFloat(trimmed.replace(',', '.'));
  if (Number.isFinite(decimalHours) && decimalHours > 0) {
    return Math.round(decimalHours * 60);
  }

  return null;
}
