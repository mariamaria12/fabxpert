import type { TimesheetEvent } from '@fabxpert/shared';

export function timesheetEventMessage(event: TimesheetEvent): string {
  switch (event.type) {
    case 'created':
      return `${event.personName} a adăugat pontaj`;
    case 'updated':
      return `${event.personName} a modificat un pontaj`;
    case 'deleted':
      return `${event.personName} a șters un pontaj`;
  }
}

/** Local-day bounds for filtering timesheets created today. */
export function todayCreatedAtRange(now = new Date()): {
  createdAtFrom: string;
  createdAtTo: string;
} {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return {
    createdAtFrom: start.toISOString(),
    createdAtTo: end.toISOString(),
  };
}

export function formatActivityTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString('ro-RO', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}
