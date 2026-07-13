/**
 * workDate convention (API, mobile, web):
 * - Semantics: calendar day the work was done (day granularity only).
 * - Wire format: `YYYY-MM-DD` string on create/update (avoids timezone shifts).
 * - Storage: Prisma DateTime at server-local midnight for that calendar day.
 * - When omitted on create, the API defaults workDate to today (server local).
 */

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseWorkDateString(value: string): Date {
  const match = ISO_DATE_PATTERN.exec(value.trim());
  if (!match) {
    throw new Error(`Invalid workDate: ${value}`);
  }

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  const date = new Date(year, month - 1, day, 0, 0, 0, 0);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new Error(`Invalid workDate: ${value}`);
  }

  return date;
}

export function normalizeWorkDate(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

export function todayWorkDate(reference = new Date()): Date {
  return normalizeWorkDate(reference);
}

export function workDateToDayKey(date: Date | string): string {
  const value = typeof date === 'string' ? new Date(date) : date;
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

export function isSameWorkDate(
  workDate: Date | string,
  reference = new Date(),
): boolean {
  return workDateToDayKey(workDate) === workDateToDayKey(reference);
}

/** `YYYY-MM-DD` for HTML date inputs (local calendar day). */
export function todayDateInputValue(reference = new Date()): string {
  return workDateToDayKey(todayWorkDate(reference));
}
