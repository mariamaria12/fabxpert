import { Prisma } from '@prisma/client';
import type { ProjectStatus } from '@fabxpert/shared/dto/project.dto';
import type {
  PinnedProjectSummaryRow,
  PinnedProjectsSummaryResponse,
  ProjectSummaryProjectRow,
  ProjectSummaryResponse,
  TimesheetSummaryPeriod,
} from '@fabxpert/shared/dto/timesheet.dto';

export type { ProjectSummaryProjectRow, ProjectSummaryResponse };

export type BuildProjectSummaryQueryOptions = {
  from?: Date | null;
  to?: Date | null;
  pinnedOnly?: boolean;
  /** When true, starts from projects and LEFT JOINs timesheets so projects with zero entries appear. */
  includeZeroEntryProjects?: boolean;
};

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
  projectStatus?: string;
  projectStartDate?: Date | null;
  projectDueDate?: Date | null;
};

const NO_ACTIVITY_LABEL = 'Fără activitate';

function buildPeriodFilter(from: Date | null, to: Date | null) {
  if (!from || !to) {
    return Prisma.empty;
  }

  return Prisma.sql`AND t."workDate" >= ${from} AND t."workDate" < ${to}`;
}

export function buildProjectSummaryQuery(
  from: Date | null,
  to: Date | null,
): Prisma.Sql;
export function buildProjectSummaryQuery(
  options: BuildProjectSummaryQueryOptions,
): Prisma.Sql;
export function buildProjectSummaryQuery(
  fromOrOptions: Date | null | BuildProjectSummaryQueryOptions,
  to: Date | null = null,
): Prisma.Sql {
  const options: BuildProjectSummaryQueryOptions =
    fromOrOptions !== null &&
    typeof fromOrOptions === 'object' &&
    !(fromOrOptions instanceof Date)
      ? fromOrOptions
      : { from: fromOrOptions, to };

  const {
    from = null,
    to: toDate = null,
    pinnedOnly = false,
    includeZeroEntryProjects = false,
  } = options;

  const pinnedFilter = pinnedOnly ? Prisma.sql`AND p."isPinned" = true` : Prisma.empty;

  if (includeZeroEntryProjects) {
    const periodOnJoin = buildPeriodFilter(from, toDate);

    return Prisma.sql`
      SELECT
        p.id AS "projectId",
        p.name AS "projectName",
        p.code AS "projectCode",
        p.color AS "projectColor",
        p.status AS "projectStatus",
        p."startDate" AS "projectStartDate",
        p."dueDate" AS "projectDueDate",
        c.id AS "companyId",
        c.name AS "companyName",
        t."activityId" AS "activityId",
        a.name AS "activityName",
        a.color AS "activityColor",
        COALESCE(SUM(t."durationMinutes"), 0)::int AS minutes
      FROM projects p
      INNER JOIN companies c ON c.id = p."companyId"
      LEFT JOIN timesheets t ON t."projectId" = p.id
        AND t."deletedAt" IS NULL
        AND EXISTS (
          SELECT 1
          FROM persons pe
          WHERE pe.id = t."personId"
            AND pe."deletedAt" IS NULL
        )
        ${periodOnJoin}
      LEFT JOIN activities a ON a.id = t."activityId"
      WHERE p."deletedAt" IS NULL
        ${pinnedFilter}
      GROUP BY
        p.id,
        p.name,
        p.code,
        p.color,
        p.status,
        p."startDate",
        p."dueDate",
        c.id,
        c.name,
        t."activityId",
        a.name,
        a.color
      ORDER BY p.name ASC, minutes DESC
    `;
  }

  const periodFilter = buildPeriodFilter(from, toDate);

  // All non-deleted project statuses are included (incl. LIVRAT, FINALIZAT, ANULAT).
  return Prisma.sql`
    SELECT
      p.id AS "projectId",
      p.name AS "projectName",
      p.code AS "projectCode",
      p.color AS "projectColor",
      p.status AS "projectStatus",
      c.id AS "companyId",
      c.name AS "companyName",
      t."activityId" AS "activityId",
      a.name AS "activityName",
      a.color AS "activityColor",
      SUM(t."durationMinutes")::int AS minutes
    FROM timesheets t
    INNER JOIN persons pe ON pe.id = t."personId" AND pe."deletedAt" IS NULL
    INNER JOIN projects p ON p.id = t."projectId" AND p."deletedAt" IS NULL
    INNER JOIN companies c ON c.id = p."companyId"
    LEFT JOIN activities a ON a.id = t."activityId"
    WHERE t."deletedAt" IS NULL
      ${periodFilter}
      ${pinnedFilter}
    GROUP BY
      p.id,
      p.name,
      p.code,
      p.color,
      p.status,
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

function upsertProjectRow(
  byProject: Map<string, ProjectSummaryProjectRow>,
  row: ProjectSummarySqlRow,
): ProjectSummaryProjectRow {
  let project = byProject.get(row.projectId);
  if (!project) {
    project = {
      id: row.projectId,
      name: row.projectName,
      code: row.projectCode,
      color: row.projectColor,
      status: row.projectStatus as ProjectStatus,
      company: { id: row.companyId, name: row.companyName },
      totalMinutes: 0,
      activities: [],
    };
    byProject.set(row.projectId, project);
  }
  return project;
}

export function shapeProjectSummary(
  rows: ProjectSummarySqlRow[],
  period: TimesheetSummaryPeriod,
): ProjectSummaryResponse {
  const byProject = new Map<string, ProjectSummaryProjectRow>();

  for (const row of rows) {
    const minutes = toMinutes(row.minutes);
    if (minutes <= 0) {
      continue;
    }

    const project = upsertProjectRow(byProject, row);
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

export function shapePinnedProjectsSummary(
  rows: ProjectSummarySqlRow[],
): PinnedProjectsSummaryResponse {
  const byProject = new Map<string, PinnedProjectSummaryRow>();

  for (const row of rows) {
    const minutes = toMinutes(row.minutes);

    let project = byProject.get(row.projectId);
    if (!project) {
      project = {
        id: row.projectId,
        name: row.projectName,
        code: row.projectCode,
        color: row.projectColor,
        status: row.projectStatus as ProjectStatus,
        startDate: row.projectStartDate?.toISOString() ?? null,
        dueDate: row.projectDueDate?.toISOString() ?? null,
        company: { id: row.companyId, name: row.companyName },
        totalMinutes: 0,
        activities: [],
      };
      byProject.set(row.projectId, project);
    }

    if (minutes > 0) {
      project.totalMinutes += minutes;
      project.activities.push({
        activityId: row.activityId,
        activityName: row.activityId ? (row.activityName ?? 'Activitate') : NO_ACTIVITY_LABEL,
        activityColor: row.activityColor,
        minutes,
      });
    }
  }

  const projects = Array.from(byProject.values()).sort((left, right) =>
    left.name.localeCompare(right.name),
  );

  for (const project of projects) {
    project.activities.sort((left, right) => right.minutes - left.minutes);
  }

  return { projects };
}
