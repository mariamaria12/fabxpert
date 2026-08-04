import { Prisma } from '@prisma/client';
import type {
  NotLoggedResponse,
  TimesheetSummaryPeriod,
} from '@fabxpert/shared/dto/timesheet.dto';

export type NotLoggedSqlRow = {
  id: string;
  firstName: string;
  lastName: string;
  employeeRoleName: string | null;
};

/**
 * Persons who logged nothing in the range. Mirrors the "au pontat" set used by
 * `todayDistinctPersonCount` (same GROUP BY / HAVING), so the two are exact
 * complements. Persons on approved leave are left out — they are counted by the
 * separate "în concediu" metric and are not expected to log time.
 */
function notLoggedPredicate(from: Date | null, to: Date | null) {
  const timesheetPeriod =
    from && to
      ? Prisma.sql`AND t."workDate" >= ${from} AND t."workDate" < ${to}`
      : Prisma.empty;

  const leaveOverlap =
    from && to
      ? Prisma.sql`AND lr."startDate" < ${to} AND lr."endDate" >= ${from}`
      : Prisma.empty;

  return Prisma.sql`
    pe."deletedAt" IS NULL
    AND pe.id NOT IN (
      SELECT t."personId"
      FROM timesheets t
      INNER JOIN projects p ON p.id = t."projectId" AND p."deletedAt" IS NULL
      WHERE t."deletedAt" IS NULL
        ${timesheetPeriod}
      GROUP BY t."personId"
      HAVING SUM(t."durationMinutes") > 0
    )
    AND NOT EXISTS (
      SELECT 1
      FROM leave_requests lr
      WHERE lr."personId" = pe.id
        AND lr."deletedAt" IS NULL
        AND lr.status = 'APROBAT'
        ${leaveOverlap}
    )
  `;
}

export function buildNotLoggedPersonsQuery(from: Date | null, to: Date | null) {
  return Prisma.sql`
    SELECT
      pe.id AS "id",
      pe."firstName" AS "firstName",
      pe."lastName" AS "lastName",
      er.name AS "employeeRoleName"
    FROM persons pe
    LEFT JOIN employee_roles er ON er.id = pe."employeeRoleId" AND er."deletedAt" IS NULL
    WHERE ${notLoggedPredicate(from, to)}
    ORDER BY pe."lastName" ASC, pe."firstName" ASC
  `;
}

export function buildNotLoggedCountQuery(from: Date | null, to: Date | null) {
  return Prisma.sql`
    SELECT COUNT(*)::int AS count
    FROM persons pe
    WHERE ${notLoggedPredicate(from, to)}
  `;
}

export function shapeNotLogged(
  rows: NotLoggedSqlRow[],
  period: TimesheetSummaryPeriod,
): NotLoggedResponse {
  return {
    period,
    persons: rows.map((row) => ({
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      employeeRoleName: row.employeeRoleName,
    })),
  };
}
