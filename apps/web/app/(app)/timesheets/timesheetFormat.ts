import type { TimesheetDto } from '@fabxpert/shared';

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

export function formatClockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ro-RO', {
    hour: '2-digit',
    minute: '2-digit',
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

export function formatTimesheetDuration(timesheet: TimesheetDto): string | null {
  if (timesheet.endTime === null) {
    return null;
  }

  const minutes = Math.round(
    (new Date(timesheet.endTime).getTime() - new Date(timesheet.startTime).getTime()) / 60000,
  );

  return formatDurationMinutes(minutes);
}

export function timesheetStatusLabel(timesheet: TimesheetDto): string {
  return timesheet.endTime === null ? 'Deschis' : 'Închis';
}

export function getLocalDayKey(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function isoToDateInput(iso: string): string {
  return getLocalDayKey(iso);
}

export function isoToTimeInput(iso: string): string {
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function combineDateAndTime(date: string, time: string): Date | null {
  if (!date || !time) {
    return null;
  }

  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!match) {
    return null;
  }

  const [year, month, day] = date.split('-').map(Number);
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);

  if (hours > 23 || minutes > 59) {
    return null;
  }

  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}
