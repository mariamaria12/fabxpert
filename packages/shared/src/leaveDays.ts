import { normalizeWorkDate } from './workDate';

/**
 * Leave date convention (API, mobile, web):
 * - Semantics: calendar day granularity (same as workDate).
 * - Wire format: `YYYY-MM-DD` string on create/update.
 * - Storage: Prisma DateTime at server-local midnight for that calendar day.
 *
 * MVP day counting: inclusive calendar days (endDate − startDate + 1).
 * Weekends and Romanian public holidays are NOT excluded yet — change here when
 * business-day logic is added post-MVP.
 */
export function countInclusiveLeaveDays(startDate: Date, endDate: Date): number {
  const start = normalizeWorkDate(startDate);
  const end = normalizeWorkDate(endDate);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((end.getTime() - start.getTime()) / msPerDay) + 1;
}

/** Calendar year attributed from startDate (MVP simplification for year-boundary spans). */
export function leaveRequestYear(startDate: Date): number {
  return normalizeWorkDate(startDate).getFullYear();
}
