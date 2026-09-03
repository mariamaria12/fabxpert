import { Prisma } from '@prisma/client';
import type {
  ActivityHoursRow,
  ClientHoursRow,
  ProductivityReportResponse,
  ProjectHoursComparisonRow,
  ReportPeriodKind,
} from '@fabxpert/shared/dto/report.dto';
import { PROJECT_COMPLETED_STATUSES } from '@fabxpert/shared/projectStatus';

const NO_ACTIVITY_LABEL = 'Fără activitate';
const OTHER_CLIENTS_LABEL = 'Alte companii';
const OTHER_ACTIVITIES_LABEL = 'Alte activități';

/** Kept small so the payload stays light regardless of interval size. */
export const TOP_PROJECTS = 15;
export const TOP_CLIENTS = 8;
export const TOP_ACTIVITIES = 8;

export type ProjectAggregateRow = {
  projectId: string;
  code: string;
  name: string;
  denumireLucrare: string | null;
  dueDate: Date | null;
  estimatedHours: number | null;
  completedAt: Date | null;
  companyId: string;
  companyName: string;
  companyColor: string | null;
  minutes: number | bigint;
};

export type ActivityAggregateRow = {
  activityId: string | null;
  activityName: string | null;
  activityColor: string | null;
  minutes: number | bigint;
};

/**
 * The statuses the analytics count as delivered work, as SQL literals. Built
 * from the shared list so the report and the completedAt stamping can never
 * drift apart.
 */
const completedStatuses = Prisma.join(
  PROJECT_COMPLETED_STATUSES.map((status) => Prisma.sql`${status}::"ProjectStatus"`),
);

/**
 * One row per delivered project completed inside [from, toExclusive), with its
 * total logged minutes (active persons, non-deleted entries). Drives the KPIs,
 * the worked-vs-estimated chart, the on-time donut and the per-client totals.
 */
export function buildProjectAggregateQuery(from: Date, toExclusive: Date): Prisma.Sql {
  return Prisma.sql`
    SELECT
      p.id AS "projectId",
      p.code AS "code",
      p.name AS "name",
      p."denumireLucrare" AS "denumireLucrare",
      p."dueDate" AS "dueDate",
      p."estimatedHours" AS "estimatedHours",
      p."completedAt" AS "completedAt",
      c.id AS "companyId",
      c.name AS "companyName",
      c.color AS "companyColor",
      COALESCE(SUM(t."durationMinutes"), 0)::int AS minutes
    FROM projects p
    INNER JOIN companies c ON c.id = p."companyId"
    LEFT JOIN timesheets t ON t."projectId" = p.id
      AND t."deletedAt" IS NULL
      AND EXISTS (
        SELECT 1 FROM persons pe
        WHERE pe.id = t."personId" AND pe."deletedAt" IS NULL
      )
    WHERE p."deletedAt" IS NULL
      AND p.status IN (${completedStatuses})
      AND p."completedAt" >= ${from}
      AND p."completedAt" < ${toExclusive}
    GROUP BY p.id, c.id, c.name, c.color
  `;
}

/**
 * Minutes grouped by activity across timesheets of the same in-scope projects.
 * A separate query because the per-project aggregate collapses the activity
 * dimension. Ordered so the caller can take the top N directly.
 */
export function buildActivityAggregateQuery(from: Date, toExclusive: Date): Prisma.Sql {
  return Prisma.sql`
    SELECT
      t."activityId" AS "activityId",
      a.name AS "activityName",
      a.color AS "activityColor",
      SUM(t."durationMinutes")::int AS minutes
    FROM timesheets t
    INNER JOIN persons pe ON pe.id = t."personId" AND pe."deletedAt" IS NULL
    INNER JOIN projects p ON p.id = t."projectId"
      AND p."deletedAt" IS NULL
      AND p.status IN (${completedStatuses})
      AND p."completedAt" >= ${from}
      AND p."completedAt" < ${toExclusive}
    LEFT JOIN activities a ON a.id = t."activityId"
    WHERE t."deletedAt" IS NULL
    GROUP BY t."activityId", a.name, a.color
    ORDER BY minutes DESC
  `;
}

function toMinutes(value: number | bigint): number {
  return typeof value === 'bigint' ? Number(value) : value;
}

/** The project's own estimate; null while the field is left empty. */
function estimatedMinutes(estimatedHours: number | null): number | null {
  return estimatedHours === null ? null : Math.round(estimatedHours * 60);
}

function dayKey(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function shapeProductivityReport(
  period: ReportPeriodKind,
  fromDay: string,
  toDay: string,
  projectRows: ProjectAggregateRow[],
  activityRows: ActivityAggregateRow[],
): ProductivityReportResponse {
  let completedCount = 0;
  let onTimeCount = 0;
  let lateCount = 0;
  let noDueDateCount = 0;
  let totalWorkedMinutes = 0;
  let totalEstimatedMinutes = 0;
  // Pooled (weighted) efficiency numerator/denominator — see efficiencyPct.
  let pooledEstimated = 0;
  let pooledWorked = 0;

  const projectHours: ProjectHoursComparisonRow[] = [];
  const clientTotals = new Map<
    string,
    { name: string; color: string | null; minutes: number }
  >();

  for (const row of projectRows) {
    completedCount += 1;
    const worked = toMinutes(row.minutes);
    totalWorkedMinutes += worked;

    // On-time vs late by calendar day. completedAt is guaranteed non-null here
    // because the query filters on it, so only a missing deadline is undecided.
    if (!row.dueDate) {
      noDueDateCount += 1;
    } else if (row.completedAt && dayKey(row.completedAt) <= dayKey(row.dueDate)) {
      onTimeCount += 1;
    } else {
      lateCount += 1;
    }

    const estimated = estimatedMinutes(row.estimatedHours);
    if (estimated !== null) {
      totalEstimatedMinutes += estimated;
      if (worked > 0) {
        pooledEstimated += estimated;
        pooledWorked += worked;
      }
    }

    projectHours.push({
      id: row.projectId,
      code: row.code,
      label: row.denumireLucrare ?? row.name,
      companyName: row.companyName,
      workedMinutes: worked,
      estimatedMinutes: estimated,
    });

    const client = clientTotals.get(row.companyId);
    if (client) {
      client.minutes += worked;
    } else {
      clientTotals.set(row.companyId, {
        name: row.companyName,
        color: row.companyColor,
        minutes: worked,
      });
    }
  }

  const efficiencyPct =
    pooledWorked > 0 ? Math.round((pooledEstimated / pooledWorked) * 100) : null;

  projectHours.sort((left, right) => right.workedMinutes - left.workedMinutes);

  return {
    period,
    from: fromDay,
    to: toDay,
    kpis: {
      completedCount,
      onTimeCount,
      lateCount,
      noDueDateCount,
      totalWorkedMinutes,
      totalEstimatedMinutes,
      efficiencyPct,
    },
    projectHours: projectHours.slice(0, TOP_PROJECTS),
    onTime: { onTime: onTimeCount, late: lateCount, noDueDate: noDueDateCount },
    byClient: shapeClientRows(clientTotals),
    byActivity: shapeActivityRows(activityRows),
  };
}

function shapeClientRows(
  clientTotals: Map<string, { name: string; color: string | null; minutes: number }>,
): ClientHoursRow[] {
  const rows = Array.from(clientTotals.entries())
    .map(([companyId, value]): ClientHoursRow => ({
      companyId,
      companyName: value.name,
      color: value.color,
      workedMinutes: value.minutes,
    }))
    .filter((row) => row.workedMinutes > 0)
    .sort((left, right) => right.workedMinutes - left.workedMinutes);

  return withOthersBucket(rows, TOP_CLIENTS, (rest) => ({
    companyId: null,
    companyName: OTHER_CLIENTS_LABEL,
    color: null,
    workedMinutes: rest,
  }));
}

function shapeActivityRows(activityRows: ActivityAggregateRow[]): ActivityHoursRow[] {
  const rows = activityRows
    .map((row) => ({
      activityId: row.activityId,
      activityName: row.activityId ? (row.activityName ?? 'Activitate') : NO_ACTIVITY_LABEL,
      color: row.activityColor,
      workedMinutes: toMinutes(row.minutes),
    }))
    .filter((row) => row.workedMinutes > 0)
    .sort((left, right) => right.workedMinutes - left.workedMinutes);

  return withOthersBucket(rows, TOP_ACTIVITIES, (rest) => ({
    activityId: null,
    activityName: OTHER_ACTIVITIES_LABEL,
    color: null,
    workedMinutes: rest,
  }));
}

/** Keep the top N rows and fold the remainder into a single "others" row. */
function withOthersBucket<T extends { workedMinutes: number }>(
  rows: T[],
  topN: number,
  makeOthers: (restMinutes: number) => T,
): T[] {
  if (rows.length <= topN) {
    return rows;
  }
  const top = rows.slice(0, topN);
  const restMinutes = rows
    .slice(topN)
    .reduce((sum, row) => sum + row.workedMinutes, 0);
  if (restMinutes > 0) {
    top.push(makeOthers(restMinutes));
  }
  return top;
}
