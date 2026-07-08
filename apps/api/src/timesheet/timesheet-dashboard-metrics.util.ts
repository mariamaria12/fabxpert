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

  const [projectCountRows, minutesRows, personCountRows] = await Promise.all([
    prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*)::int AS count
      FROM projects p
      WHERE p."deletedAt" IS NULL
        AND p.status NOT IN ('FINALIZAT', 'ANULAT')
    `,
    prisma.$queryRaw<MinutesRow[]>`
      SELECT FLOOR(
        SUM(EXTRACT(EPOCH FROM (t."endTime" - t."startTime"))) / 60
      )::int AS minutes
      FROM timesheets t
      WHERE t."deletedAt" IS NULL
        AND t."endTime" IS NOT NULL
        AND t."startTime" >= ${from}
        AND t."startTime" < ${to}
    `,
    prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(DISTINCT t."personId")::int AS count
      FROM timesheets t
      WHERE t."deletedAt" IS NULL
        AND t."endTime" IS NOT NULL
        AND t."startTime" >= ${from}
        AND t."startTime" < ${to}
    `,
  ]);

  return {
    inProgressProjectCount: toNumber(projectCountRows[0]?.count),
    todayTotalMinutes: toNumber(minutesRows[0]?.minutes),
    todayDistinctPersonCount: toNumber(personCountRows[0]?.count),
  };
}
