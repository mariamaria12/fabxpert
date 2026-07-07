import type { TimesheetDto } from '@fabxpert/shared';
import { getLocalDayKey } from './timesheetFormat';

/** TODO: switch to server-side search when GET /timesheets?search=... is available. */
export function timesheetMatchesPersonSearch(timesheet: TimesheetDto, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  const fullName = `${timesheet.person.firstName} ${timesheet.person.lastName}`.toLowerCase();
  const fields = [
    fullName,
    timesheet.person.firstName.toLowerCase(),
    timesheet.person.lastName.toLowerCase(),
  ];

  return fields.some((field) => field.includes(normalizedQuery));
}

/** TODO: switch to server-side date filtering when the API supports date range params. */
export function timesheetMatchesDateRange(
  timesheet: TimesheetDto,
  from?: string,
  to?: string,
): boolean {
  if (!from && !to) {
    return true;
  }

  const dayKey = getLocalDayKey(timesheet.startTime);

  if (from && dayKey < from) {
    return false;
  }

  if (to && dayKey > to) {
    return false;
  }

  return true;
}

export function paginateSlice<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

/** Max rows fetched for client-side filters until API search/date params exist. */
export const CLIENT_FILTER_FETCH_SIZE = 500;
