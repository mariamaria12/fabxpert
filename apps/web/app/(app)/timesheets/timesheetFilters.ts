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

/** Same order as GET /timesheets/export.xlsx (workDate asc, person, project). */
export function sortTimesheetsForExport(rows: TimesheetDto[]): TimesheetDto[] {
  return [...rows].sort((left, right) => {
    const dateCompare =
      new Date(left.workDate).getTime() - new Date(right.workDate).getTime();
    if (dateCompare !== 0) {
      return dateCompare;
    }

    const lastNameCompare = left.person.lastName.localeCompare(
      right.person.lastName,
      'ro',
    );
    if (lastNameCompare !== 0) {
      return lastNameCompare;
    }

    const firstNameCompare = left.person.firstName.localeCompare(
      right.person.firstName,
      'ro',
    );
    if (firstNameCompare !== 0) {
      return firstNameCompare;
    }

    return left.project.name.localeCompare(right.project.name, 'ro');
  });
}
