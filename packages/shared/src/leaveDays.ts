import { normalizeWorkDate } from './workDate';

/**
 * Leave date convention (API, mobile, web):
 * - Semantics: calendar day granularity (same as workDate).
 * - Wire format: `YYYY-MM-DD` string on create/update.
 * - Storage: Prisma DateTime at server-local midnight for that calendar day.
 *
 * Day counting: inclusive range between startDate and endDate, excluding
 * Saturday and Sunday. Romanian public holidays are not excluded yet.
 */
export function countInclusiveLeaveDays(startDate: Date, endDate: Date): number {
  const start = normalizeWorkDate(startDate);
  const end = normalizeWorkDate(endDate);
  let count = 0;
  const cursor = new Date(start);

  while (cursor.getTime() <= end.getTime()) {
    const dayOfWeek = cursor.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count += 1;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return count;
}

/** Calendar year attributed from startDate (MVP simplification for year-boundary spans). */
export function leaveRequestYear(startDate: Date): number {
  return normalizeWorkDate(startDate).getFullYear();
}
