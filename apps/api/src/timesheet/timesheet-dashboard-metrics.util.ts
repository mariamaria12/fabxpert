import { Prisma } from '@prisma/client';
import type { DashboardMetricsResponse } from '@fabxpert/shared/dto/timesheet.dto';
import { getTodayRange } from './timesheet-summary-period.util';

type CountRow = { count: number | bigint };
type MinutesRow = { minutes: number | bigint | null };

function toNumber(value: number | bigint | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }
  return typeof value === 'bigint' ? Number(value) : value;
}

export async function queryDashboardMetrics(
  prisma: { $queryRaw: Prisma.DefaultPrismaClient['$queryRaw'] },
  now = new Date(),
): Promise<DashboardMetricsResponse> {
  const { from, to } = getTodayRange(now);

  const [projectCountRows, minutesRows, personCountRows, onLeaveCountRows] = await Promise.all([
    prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*)::int AS count
      FROM projects p
      WHERE p."deletedAt" IS NULL
        AND p.status NOT IN ('FINALIZAT', 'ANULAT')
    `,
    prisma.$queryRaw<MinutesRow[]>`
      SELECT COALESCE(SUM(t."durationMinutes"), 0)::int AS minutes
      FROM timesheets t
      INNER JOIN persons pe ON pe.id = t."personId" AND pe."deletedAt" IS NULL
      INNER JOIN projects p ON p.id = t."projectId" AND p."deletedAt" IS NULL
      WHERE t."deletedAt" IS NULL
        AND t."workDate" >= ${from}
        AND t."workDate" < ${to}
    `,
    prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*)::int AS count
      FROM (
        SELECT t."personId"
        FROM timesheets t
        INNER JOIN persons pe ON pe.id = t."personId" AND pe."deletedAt" IS NULL
        INNER JOIN projects p ON p.id = t."projectId" AND p."deletedAt" IS NULL
        WHERE t."deletedAt" IS NULL
          AND t."workDate" >= ${from}
          AND t."workDate" < ${to}
        GROUP BY t."personId"
        HAVING SUM(t."durationMinutes") > 0
      ) counted
    `,
    prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(DISTINCT lr."personId")::int AS count
      FROM leave_requests lr
      WHERE lr."deletedAt" IS NULL
        AND lr.status = 'APROBAT'
        AND lr."startDate" < ${to}
        AND lr."endDate" >= ${from}
    `,
  ]);

  return {
    inProgressProjectCount: toNumber(projectCountRows[0]?.count),
    todayTotalMinutes: toNumber(minutesRows[0]?.minutes),
    todayDistinctPersonCount: toNumber(personCountRows[0]?.count),
    todayOnLeaveCount: toNumber(onLeaveCountRows[0]?.count),
  };
}
