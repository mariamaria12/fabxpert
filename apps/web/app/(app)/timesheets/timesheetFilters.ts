import type { TimesheetDto } from '@fabxpert/shared';

/** Max rows fetched for export preview (full export uses server-side XLSX). */
export const EXPORT_PREVIEW_FETCH_SIZE = 500;

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
