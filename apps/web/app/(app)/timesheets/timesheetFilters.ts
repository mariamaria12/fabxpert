import type { TimesheetDto } from '@fabxpert/shared';

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

export function paginateSlice<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

/** Max rows fetched for client-side person search until API search exists. */
export const CLIENT_SEARCH_FETCH_SIZE = 500;
