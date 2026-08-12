/**
 * Timesheet notes squeezed onto one line for the payroll export and its preview.
 * The cell renders as a single line, so a raw line break would run two thoughts
 * together — each break becomes a visible bullet instead.
 */
export function formatTimesheetNotesCell(notes: string | null | undefined): string {
  if (!notes) {
    return '';
  }

  return notes
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join(' • ');
}
