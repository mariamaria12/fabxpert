import { Prisma } from '@prisma/client';
import { isWorkingDate, normalizeWorkDate, workDateToDayKey } from '@fabxpert/shared/workDate';
import type {
  PersonAccountGroup,
  NotLoggedResponse,
  TimesheetSummaryPeriod,
} from '@fabxpert/shared/dto/timesheet.dto';

export type NotLoggedSqlRow = {
  id: string;
  firstName: string;
  lastName: string;
  employeeRoleName: string | null;
  group: PersonAccountGroup;
  /** Positions in the checked days; null for the whole-history check. */
  dayIndexes: number[] | null;
};

/** Live account for a person, if any — soft-deleted users don't count. */
const accountJoin = Prisma.sql`
  LEFT JOIN users u ON u."personId" = pe.id AND u."deletedAt" IS NULL
`;

/**
 * The days a period is checked on: its working days up to today — a day still
 * ahead cannot be missed yet. A period with no working day in it (a weekend
 * day on its own) is checked on its calendar days instead, so asking about a
 * Saturday still answers who logged nothing that Saturday.
 */
export function notLoggedCheckDays(from: Date, to: Date, now = new Date()): Date[] {
  const tomorrow = normalizeWorkDate(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const end = to < tomorrow ? to : tomorrow;

  const calendarDays: Date[] = [];
  for (const cursor = normalizeWorkDate(from); cursor < end; cursor.setDate(cursor.getDate() + 1)) {
    calendarDays.push(new Date(cursor));
  }

  const workingDays = calendarDays.filter((day) => isWorkingDate(day));
  return workingDays.length > 0 ? workingDays : calendarDays;
}

/**
 * Who is left out entirely: admin and office accounts (not expected to log),
 * and external collaborators unless `includeExternal`.
 */
function expectedToLog(includeExternal: boolean) {
  // External collaborators are off by default — they are not expected to log
  // time like employees.
  const externalFilter = includeExternal
    ? Prisma.empty
    : Prisma.sql`AND (u.id IS NULL OR NOT u."angajatExtern")`;

  return Prisma.sql`
    pe."deletedAt" IS NULL
    AND (u.id IS NULL OR (u.role <> 'ADMIN' AND NOT u."isOfficeUser"))
    ${externalFilter}
  `;
}

/**
 * With no period ("toate"), who never logged anything and has no approved
 * leave at all. Mirrors the "au pontat" set used by `distinctPersonCount`
 * (same GROUP BY / HAVING), so the two agree on who counts as having logged.
 */
function neverLoggedPredicate(includeExternal: boolean) {
  return Prisma.sql`
    ${expectedToLog(includeExternal)}
    AND pe.id NOT IN (
      SELECT t."personId"
      FROM timesheets t
      INNER JOIN projects p ON p.id = t."projectId" AND p."deletedAt" IS NULL
      WHERE t."deletedAt" IS NULL
      GROUP BY t."personId"
      HAVING SUM(t."durationMinutes") > 0
    )
    AND NOT EXISTS (
      SELECT 1
      FROM leave_requests lr
      WHERE lr."personId" = pe.id
        AND lr."deletedAt" IS NULL
        AND lr.status = 'APROBAT'
    )
  `;
}

/**
 * Per person, the positions in `days` they logged nothing on and had no
 * approved leave covering. A person with no such day gets NULL, so a period
 * lists everyone with at least one day missing, not only those missing all of it.
 */
function missingDaysLateral(days: Date[]) {
  const values = Prisma.join(
    days.map((day, index) => Prisma.sql`(${index}::int, ${day}::timestamp)`),
  );

  return Prisma.sql`
    CROSS JOIN LATERAL (
      SELECT array_agg(days.i ORDER BY days.i) AS "dayIndexes"
      FROM (VALUES ${values}) AS days(i, d)
      WHERE NOT EXISTS (
          SELECT 1
          FROM timesheets t
          INNER JOIN projects p ON p.id = t."projectId" AND p."deletedAt" IS NULL
          WHERE t."personId" = pe.id
            AND t."deletedAt" IS NULL
            AND t."workDate" = days.d
          HAVING SUM(t."durationMinutes") > 0
        )
        AND NOT EXISTS (
          SELECT 1
          FROM leave_requests lr
          WHERE lr."personId" = pe.id
            AND lr."deletedAt" IS NULL
            AND lr.status = 'APROBAT'
            AND lr."startDate" <= days.d
            AND lr."endDate" >= days.d
        )
    ) missing
  `;
}

export function buildNotLoggedPersonsQuery(
  from: Date | null,
  to: Date | null,
  includeExternal = false,
) {
  const days = from && to ? notLoggedCheckDays(from, to) : null;
  const select = Prisma.sql`
    pe.id AS "id",
    pe."firstName" AS "firstName",
    pe."lastName" AS "lastName",
    er.name AS "employeeRoleName",
    CASE WHEN u."angajatExtern" THEN 'external' ELSE 'employee' END AS "group"
  `;
  const joins = Prisma.sql`
    ${accountJoin}
    LEFT JOIN employee_roles er ON er.id = pe."employeeRoleId" AND er."deletedAt" IS NULL
  `;
  const order = Prisma.sql`ORDER BY pe."lastName" ASC, pe."firstName" ASC`;

  if (!days) {
    return {
      days: [],
      query: Prisma.sql`
        SELECT ${select}, NULL::int[] AS "dayIndexes"
        FROM persons pe
        ${joins}
        WHERE ${neverLoggedPredicate(includeExternal)}
        ${order}
      `,
    };
  }
  if (days.length === 0) {
    return { days, query: null };
  }

  return {
    days,
    query: Prisma.sql`
      SELECT ${select}, missing."dayIndexes" AS "dayIndexes"
      FROM persons pe
      ${joins}
      ${missingDaysLateral(days)}
      WHERE ${expectedToLog(includeExternal)}
        AND missing."dayIndexes" IS NOT NULL
      ${order}
    `,
  };
}

/** Null when the period has no day to check yet — nobody can have missed it. */
export function buildNotLoggedCountQuery(
  from: Date | null,
  to: Date | null,
  includeExternal = false,
) {
  if (!from || !to) {
    return Prisma.sql`
      SELECT COUNT(*)::int AS count
      FROM persons pe
      ${accountJoin}
      WHERE ${neverLoggedPredicate(includeExternal)}
    `;
  }

  const days = notLoggedCheckDays(from, to);
  if (days.length === 0) {
    return null;
  }

  return Prisma.sql`
    SELECT COUNT(*)::int AS count
    FROM persons pe
    ${accountJoin}
    ${missingDaysLateral(days)}
    WHERE ${expectedToLog(includeExternal)}
      AND missing."dayIndexes" IS NOT NULL
  `;
}

export function shapeNotLogged(
  rows: NotLoggedSqlRow[],
  days: Date[],
  period: TimesheetSummaryPeriod,
): NotLoggedResponse {
  return {
    period,
    persons: rows.map((row) => ({
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      employeeRoleName: row.employeeRoleName,
      group: row.group,
      missingDays: (row.dayIndexes ?? []).map((index) => workDateToDayKey(days[index])),
    })),
  };
}
