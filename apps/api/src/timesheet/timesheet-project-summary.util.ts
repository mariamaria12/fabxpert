import { Prisma } from '@prisma/client';
import type { ProjectSummaryPeriod } from '@fabxpert/shared/dto/timesheet.dto';

export type ProjectSummarySqlRow = {
  projectId: string;
  projectName: string;
  projectCode: string;
  projectColor: string | null;
  companyId: string;
  companyName: string;
  activityId: string | null;
  activityName: string | null;
  activityColor: string | null;
  minutes: number | bigint;
};

export type ProjectSummaryActivityRow = {
  activityId: string | null;
  activityName: string;
  activityColor: string | null;
  minutes: number;
};

export type ProjectSummaryProjectRow = {
  id: string;
  name: string;
  code: string;
  color: string | null;
  company: { id: string; name: string };
  totalMinutes: number;
  activities: ProjectSummaryActivityRow[];
};

export type ProjectSummaryResponse = {
  period: ProjectSummaryPeriod;
  projects: ProjectSummaryProjectRow[];
};

const NO_ACTIVITY_LABEL = 'Fără activitate';

/** Server-local calendar ranges; timezone simplification is intentional. */
export function resolveProjectSummaryPeriodRange(
  period: ProjectSummaryPeriod,
  now = new Date(),
): { from: Date | null; to: Date | null } {
  if (period === 'all') {
    return { from: null, to: null };
  }

  if (period === 'month') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
    return { from, to };
  }

  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() + diffToMonday);

  const to = new Date(from);
  to.setDate(to.getDate() + 7);

  return { from, to };
}

export function buildProjectSummaryQuery(from: Date | null, to: Date | null) {
  const periodFilter =
    from && to
      ? Prisma.sql`AND t."startTime" >= ${from} AND t."startTime" < ${to}`
      : Prisma.empty;

  return Prisma.sql`
    SELECT
      p.id AS "projectId",
      p.name AS "projectName",
      p.code AS "projectCode",
      p.color AS "projectColor",
      c.id AS "companyId",
      c.name AS "companyName",
      t."activityId" AS "activityId",
      a.name AS "activityName",
      a.color AS "activityColor",
      FLOOR(
        SUM(EXTRACT(EPOCH FROM (t."endTime" - t."startTime"))) / 60
      )::int AS minutes
    FROM timesheets t
    INNER JOIN projects p ON p.id = t."projectId"
    INNER JOIN companies c ON c.id = p."companyId"
    LEFT JOIN activities a ON a.id = t."activityId"
    WHERE t."deletedAt" IS NULL
      AND t."endTime" IS NOT NULL
      AND p."deletedAt" IS NULL
      AND p.status NOT IN ('FINALIZAT', 'ANULAT')
      ${periodFilter}
    GROUP BY
      p.id,
      p.name,
      p.code,
      p.color,
      c.id,
      c.name,
      t."activityId",
      a.name,
      a.color
    ORDER BY p.id ASC, minutes DESC
  `;
}

function toMinutes(value: number | bigint): number {
  return typeof value === 'bigint' ? Number(value) : value;
}

export function shapeProjectSummary(
  rows: ProjectSummarySqlRow[],
  period: ProjectSummaryPeriod,
): ProjectSummaryResponse {
  const byProject = new Map<string, ProjectSummaryProjectRow>();

  for (const row of rows) {
    const minutes = toMinutes(row.minutes);
    if (minutes <= 0) {
      continue;
    }

    let project = byProject.get(row.projectId);
    if (!project) {
      project = {
        id: row.projectId,
        name: row.projectName,
        code: row.projectCode,
        color: row.projectColor,
        company: { id: row.companyId, name: row.companyName },
        totalMinutes: 0,
        activities: [],
      };
      byProject.set(row.projectId, project);
    }

    project.totalMinutes += minutes;
    project.activities.push({
      activityId: row.activityId,
      activityName: row.activityId ? (row.activityName ?? 'Activitate') : NO_ACTIVITY_LABEL,
      activityColor: row.activityColor,
      minutes,
    });
  }

  const projects = Array.from(byProject.values())
    .filter((project) => project.totalMinutes > 0)
    .sort((left, right) => right.totalMinutes - left.totalMinutes);

  for (const project of projects) {
    project.activities.sort((left, right) => right.minutes - left.minutes);
  }

  return { period, projects };
}
