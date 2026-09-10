import { Prisma } from '@prisma/client';
import type {
  ActiveProjectRow,
  ActiveProjectStepRow,
  ActiveProjectsReportResponse,
  AssemblyStepProgress,
} from '@fabxpert/shared/dto/report.dto';
import type { ProjectStatus } from '@fabxpert/shared/dto/project.dto';
import { PROJECT_ACTIVE_STATUSES } from '@fabxpert/shared/projectStatus';
import type { ProjectAssemblyProgressIndex } from '../timesheet/timesheet-project-summary.util';

/** Built from the shared list so the report and the status meaning cannot drift. */
const activeStatuses = Prisma.join(
  PROJECT_ACTIVE_STATUSES.map((status) => Prisma.sql`${status}::"ProjectStatus"`),
);

export type ActiveProjectSqlRow = {
  projectId: string;
  code: string;
  name: string;
  denumireLucrare: string | null;
  status: ProjectStatus;
  dueDate: Date | null;
  estimatedHours: number | null;
  companyName: string;
  minutes: number | bigint;
};

export type ActiveProjectActivitySqlRow = {
  projectId: string;
  activityId: string;
  activityName: string | null;
  activityColor: string | null;
  tracksAssemblies: boolean;
  minutes: number | bigint;
};

/** One row per project still in the shop, with the hours logged against it. */
export function buildActiveProjectsQuery(): Prisma.Sql {
  return Prisma.sql`
    SELECT
      p.id AS "projectId",
      p.code AS "code",
      p.name AS "name",
      p."denumireLucrare" AS "denumireLucrare",
      p.status AS "status",
      p."dueDate" AS "dueDate",
      p."estimatedHours" AS "estimatedHours",
      c.name AS "companyName",
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
      AND p.status IN (${activeStatuses})
    GROUP BY p.id, c.name
  `;
}

/**
 * Hours per project per activity, for the steps the progress bars sit against.
 * Only activities tracked assembly by assembly — the rest carry no pieces to
 * compare hours with.
 */
export function buildActiveProjectActivitiesQuery(projectIds: string[]): Prisma.Sql {
  return Prisma.sql`
    SELECT
      t."projectId" AS "projectId",
      t."activityId" AS "activityId",
      a.name AS "activityName",
      a.color AS "activityColor",
      a."tracksAssemblies" AS "tracksAssemblies",
      SUM(t."durationMinutes")::int AS minutes
    FROM timesheets t
    INNER JOIN persons pe ON pe.id = t."personId" AND pe."deletedAt" IS NULL
    INNER JOIN activities a ON a.id = t."activityId" AND a."tracksAssemblies" = true
    WHERE t."deletedAt" IS NULL
      AND t."projectId" IN (${Prisma.join(projectIds)})
    GROUP BY t."projectId", t."activityId", a.name, a.color, a."tracksAssemblies"
  `;
}

function toNumber(value: number | bigint): number {
  return typeof value === 'bigint' ? Number(value) : value;
}

/**
 * How far a step has got, as a percentage. Kilograms when the list carries
 * weights, pieces otherwise — a list without weights is still a list. Null
 * when there is nothing to measure against.
 */
export function stepProgressPct(progress: AssemblyStepProgress): number | null {
  if (progress.weightTotalKg > 0) {
    return Math.round((progress.weightDoneKg / progress.weightTotalKg) * 100);
  }
  if (progress.piecesTotal > 0) {
    return Math.round((progress.piecesDone / progress.piecesTotal) * 100);
  }
  return null;
}

/** Whole days from today to the deadline; negative once it has passed. */
export function daysUntil(dueDate: Date, now: Date): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const due = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

function buildStepProgress(
  index: ProjectAssemblyProgressIndex,
  projectId: string,
  activityId: string,
): AssemblyStepProgress {
  const key = `${projectId}|${activityId}`;
  return {
    piecesDone: index.doneByProjectActivity.get(key) ?? 0,
    piecesTotal: index.totalByProject.get(projectId) ?? 0,
    weightDoneKg: index.weightDoneByProjectActivity.get(key) ?? 0,
    weightTotalKg: index.weightTotalByProject.get(projectId) ?? 0,
    piecesManual: index.manualByProjectActivity.get(key) ?? 0,
    weightManualKg: index.weightManualByProjectActivity.get(key) ?? 0,
  };
}

type StepSeed = {
  activityId: string;
  activityName: string;
  color: string | null;
  minutes: number;
};

/**
 * The steps in play on a project: the tracked activities someone logged hours
 * against, plus the ones only ticked by hand. A step nobody has touched yet is
 * left out — the project has not reached it, and counting it as 0% would drag
 * the physical figure down for work that was never meant to have started.
 */
function collectSteps(
  projectId: string,
  activityRows: ActiveProjectActivitySqlRow[],
  index: ProjectAssemblyProgressIndex,
): StepSeed[] {
  const seeds = new Map<string, StepSeed>();

  for (const row of activityRows) {
    seeds.set(row.activityId, {
      activityId: row.activityId,
      activityName: row.activityName ?? 'Activitate',
      color: row.activityColor,
      minutes: toNumber(row.minutes),
    });
  }

  for (const manual of index.manualActivities) {
    if (manual.projectId !== projectId || seeds.has(manual.activityId)) {
      continue;
    }
    seeds.set(manual.activityId, {
      activityId: manual.activityId,
      activityName: manual.activityName,
      color: manual.activityColor,
      minutes: 0,
    });
  }

  return Array.from(seeds.values());
}

export function shapeActiveProjectsReport(
  projectRows: ActiveProjectSqlRow[],
  activityRows: ActiveProjectActivitySqlRow[],
  index: ProjectAssemblyProgressIndex,
  now = new Date(),
): ActiveProjectsReportResponse {
  const activitiesByProject = new Map<string, ActiveProjectActivitySqlRow[]>();
  for (const row of activityRows) {
    const list = activitiesByProject.get(row.projectId) ?? [];
    list.push(row);
    activitiesByProject.set(row.projectId, list);
  }

  const rows: ActiveProjectRow[] = [];

  for (const project of projectRows) {
    const workedMinutes = toNumber(project.minutes);
    const estimatedMinutes =
      project.estimatedHours === null ? null : Math.round(project.estimatedHours * 60);

    const steps: ActiveProjectStepRow[] = [];
    let cappedSum = 0;
    let cappedCount = 0;

    for (const seed of collectSteps(
      project.projectId,
      activitiesByProject.get(project.projectId) ?? [],
      index,
    )) {
      const progress = buildStepProgress(index, project.projectId, seed.activityId);
      const pct = stepProgressPct(progress);
      if (pct === null) {
        continue;
      }

      steps.push({
        activityId: seed.activityId,
        activityName: seed.activityName,
        color: seed.color,
        workedMinutes: seed.minutes,
        progress,
        progressPct: pct,
      });

      // Over-reported steps are shown as they are but capped here: one step at
      // 130% must not make a project look further along than it is.
      cappedSum += Math.min(pct, 100);
      cappedCount += 1;
    }

    // A project with neither an estimate nor an assembly list has nothing to
    // compare, so it would be an empty row.
    if (estimatedMinutes === null && cappedCount === 0) {
      continue;
    }

    steps.sort((left, right) => right.workedMinutes - left.workedMinutes);

    const hoursPct =
      estimatedMinutes !== null && estimatedMinutes > 0
        ? Math.round((workedMinutes / estimatedMinutes) * 100)
        : null;
    const physicalPct = cappedCount > 0 ? Math.round(cappedSum / cappedCount) : null;

    rows.push({
      id: project.projectId,
      code: project.code,
      label: project.denumireLucrare ?? project.name,
      companyName: project.companyName,
      status: project.status,
      dueDate: project.dueDate?.toISOString() ?? null,
      daysToDue: project.dueDate ? daysUntil(project.dueDate, now) : null,
      workedMinutes,
      estimatedMinutes,
      hoursPct,
      physicalPct,
      gapPct: hoursPct !== null && physicalPct !== null ? hoursPct - physicalPct : null,
      steps,
    });
  }

  // Hours running furthest ahead of the work first — that is the warning the
  // report exists for. Rows without a gap fall back to the nearest deadline.
  rows.sort((left, right) => {
    if (left.gapPct !== null && right.gapPct !== null) {
      return right.gapPct - left.gapPct;
    }
    if (left.gapPct !== null) {
      return -1;
    }
    if (right.gapPct !== null) {
      return 1;
    }
    const leftDue = left.daysToDue ?? Number.MAX_SAFE_INTEGER;
    const rightDue = right.daysToDue ?? Number.MAX_SAFE_INTEGER;
    return leftDue - rightDue;
  });

  return { rows, generatedAt: now.toISOString() };
}
