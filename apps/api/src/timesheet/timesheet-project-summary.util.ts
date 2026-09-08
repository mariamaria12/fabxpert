import { Prisma } from '@prisma/client';
import type { ProjectStatus } from '@fabxpert/shared/dto/project.dto';
import type {
  PinnedProjectSummaryRow,
  PinnedProjectsSummaryResponse,
  ProjectSummaryAssemblyProgress,
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
  projectDenumireLucrare: string | null;
  projectFinisaj: string | null;
  projectCode: string;
  projectColor: string | null;
  projectIndexPanou?: number | null;
  projectPanouColumn?: number | null;
  companyId: string;
  companyName: string;
  activityId: string | null;
  activityName: string | null;
  activityColor: string | null;
  /** Null when the entry has no activity at all. */
  activityTracksAssemblies?: boolean | null;
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
        p."denumireLucrare" AS "projectDenumireLucrare",
        p.finisaj AS "projectFinisaj",
        p.code AS "projectCode",
        p.color AS "projectColor",
        p."indexPanou" AS "projectIndexPanou",
        p."panouColumn" AS "projectPanouColumn",
        p.status AS "projectStatus",
        p."startDate" AS "projectStartDate",
        p."dueDate" AS "projectDueDate",
        c.id AS "companyId",
        c.name AS "companyName",
        t."activityId" AS "activityId",
        a.name AS "activityName",
        a.color AS "activityColor",
        a."tracksAssemblies" AS "activityTracksAssemblies",
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
        p."denumireLucrare",
        p.finisaj,
        p.code,
        p.color,
        p."indexPanou",
        p."panouColumn",
        p.status,
        p."startDate",
        p."dueDate",
        c.id,
        c.name,
        t."activityId",
        a.name,
        a.color,
        a."tracksAssemblies"
      ORDER BY p."panouColumn" ASC NULLS LAST, p."indexPanou" ASC NULLS LAST, p.name ASC, minutes DESC
    `;
  }

  const periodFilter = buildPeriodFilter(from, toDate);

  // All non-deleted project statuses are included (incl. LIVRAT, FINALIZAT, ANULAT).
  return Prisma.sql`
    SELECT
      p.id AS "projectId",
      p.name AS "projectName",
      p."denumireLucrare" AS "projectDenumireLucrare",
      p.finisaj AS "projectFinisaj",
      p.code AS "projectCode",
      p.color AS "projectColor",
      p.status AS "projectStatus",
      c.id AS "companyId",
      c.name AS "companyName",
      t."activityId" AS "activityId",
      a.name AS "activityName",
      a.color AS "activityColor",
      a."tracksAssemblies" AS "activityTracksAssemblies",
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
      p."denumireLucrare",
      p.finisaj,
      p.code,
      p.color,
      p.status,
      c.id,
      c.name,
      t."activityId",
      a.name,
      a.color,
      a."tracksAssemblies"
    ORDER BY p.id ASC, minutes DESC
  `;
}

export type ProjectSummaryAssemblyDoneSqlRow = {
  projectId: string;
  activityId: string;
  /** Carried so a step done entirely outside the app can still be named. */
  activityName: string | null;
  activityColor: string | null;
  activityTracksAssemblies: boolean | null;
  piecesDone: number | bigint;
  /** Kilograms closed; lines without a weight per piece add nothing. */
  weightDoneKg: number | null;
  /** The slice of the two above that was ticked by hand, not pontaged. */
  piecesManual: number | bigint;
  weightManualKg: number | null;
};

export type ProjectSummaryAssemblyTotalSqlRow = {
  projectId: string;
  piecesTotal: number | bigint;
  /** Lines on the list, regardless of quantity. */
  assemblyCount: number | bigint;
  /** Kilograms the list holds, over the lines that carry a weight. */
  weightTotalKg: number | null;
  /** Lines with no weight per piece. */
  assembliesWithoutWeight: number | bigint;
};

/**
 * Pieces closed per project per activity, over both sources: the timesheets
 * that covered the marks, and the entries an admin ticked by hand for work that
 * never passed through a timesheet. The manual slice is summed separately as
 * well as into the total, so the bar can show it in its own colour and so
 * productivity can later be read over hours actually worked.
 *
 * The summary's period deliberately does not apply here: this is how far the
 * project has got on its list, which a "today" filter must not shrink.
 */
export function buildProjectSummaryAssemblyDoneQuery(projectIds: string[]) {
  return Prisma.sql`
    SELECT
      src."projectId" AS "projectId",
      src."activityId" AS "activityId",
      a.name AS "activityName",
      a.color AS "activityColor",
      a."tracksAssemblies" AS "activityTracksAssemblies",
      SUM(src."piecesDone")::int AS "piecesDone",
      SUM(src."weightDoneKg")::float AS "weightDoneKg",
      SUM(src."piecesManual")::int AS "piecesManual",
      SUM(src."weightManualKg")::float AS "weightManualKg"
    FROM (
      SELECT
        t."projectId" AS "projectId",
        ta."activityId" AS "activityId",
        ta."quantityDone" AS "piecesDone",
        ta."quantityDone" * COALESCE(pa."weightPerPiece", 0) AS "weightDoneKg",
        0 AS "piecesManual",
        0::float AS "weightManualKg"
      FROM timesheet_assemblies ta
      INNER JOIN timesheets t ON t.id = ta."timesheetId" AND t."deletedAt" IS NULL
      INNER JOIN project_assemblies pa ON pa.id = ta."assemblyId" AND pa."deletedAt" IS NULL
      WHERE t."projectId" IN (${Prisma.join(projectIds)})

      UNION ALL

      SELECT
        pa."projectId" AS "projectId",
        amp."activityId" AS "activityId",
        amp."quantityDone" AS "piecesDone",
        amp."quantityDone" * COALESCE(pa."weightPerPiece", 0) AS "weightDoneKg",
        amp."quantityDone" AS "piecesManual",
        amp."quantityDone" * COALESCE(pa."weightPerPiece", 0) AS "weightManualKg"
      FROM assembly_manual_progress amp
      INNER JOIN project_assemblies pa ON pa.id = amp."assemblyId" AND pa."deletedAt" IS NULL
      WHERE pa."projectId" IN (${Prisma.join(projectIds)})
    ) src
    LEFT JOIN activities a ON a.id = src."activityId"
    GROUP BY src."projectId", src."activityId", a.name, a.color, a."tracksAssemblies"
  `;
}

/**
 * Pieces the imported list holds, per project — the denominator. Counts the
 * list itself, so it is the same for every activity on the project.
 */
export function buildProjectSummaryAssemblyTotalQuery(projectIds: string[]) {
  return Prisma.sql`
    SELECT
      pa."projectId" AS "projectId",
      SUM(pa.quantity)::int AS "piecesTotal",
      COUNT(*)::int AS "assemblyCount",
      SUM(pa.quantity * COALESCE(pa."weightPerPiece", 0))::float AS "weightTotalKg",
      COUNT(*) FILTER (WHERE pa."weightPerPiece" IS NULL)::int AS "assembliesWithoutWeight"
    FROM project_assemblies pa
    WHERE pa."deletedAt" IS NULL
      AND pa."projectId" IN (${Prisma.join(projectIds)})
    GROUP BY pa."projectId"
  `;
}

/** Done, total and list length, keyed for the shaping pass. */
export type ProjectAssemblyProgressIndex = {
  doneByProjectActivity: Map<string, number>;
  weightDoneByProjectActivity: Map<string, number>;
  totalByProject: Map<string, number>;
  weightTotalByProject: Map<string, number>;
  withoutWeightByProject: Map<string, number>;
  assemblyCountByProject: Map<string, number>;
  manualByProjectActivity: Map<string, number>;
  weightManualByProjectActivity: Map<string, number>;
  /**
   * Steps that carry manual progress. A fully outsourced activity has no hours
   * behind it, so it produces no breakdown row of its own — these put it back.
   */
  manualActivities: {
    projectId: string;
    activityId: string;
    activityName: string;
    activityColor: string | null;
  }[];
};

function assemblyKey(projectId: string, activityId: string): string {
  return `${projectId}|${activityId}`;
}

export function indexProjectAssemblyProgress(
  doneRows: ProjectSummaryAssemblyDoneSqlRow[],
  totalRows: ProjectSummaryAssemblyTotalSqlRow[],
): ProjectAssemblyProgressIndex {
  const doneByProjectActivity = new Map<string, number>();
  const weightDoneByProjectActivity = new Map<string, number>();
  const manualByProjectActivity = new Map<string, number>();
  const weightManualByProjectActivity = new Map<string, number>();
  const manualActivities: ProjectAssemblyProgressIndex['manualActivities'] = [];

  for (const row of doneRows) {
    const key = assemblyKey(row.projectId, row.activityId);
    doneByProjectActivity.set(key, toMinutes(row.piecesDone));
    weightDoneByProjectActivity.set(key, row.weightDoneKg ?? 0);

    const manualPieces = toMinutes(row.piecesManual);
    manualByProjectActivity.set(key, manualPieces);
    weightManualByProjectActivity.set(key, row.weightManualKg ?? 0);

    if (manualPieces > 0 && row.activityTracksAssemblies) {
      manualActivities.push({
        projectId: row.projectId,
        activityId: row.activityId,
        activityName: row.activityName ?? 'Activitate',
        activityColor: row.activityColor,
      });
    }
  }

  const totalByProject = new Map<string, number>();
  const weightTotalByProject = new Map<string, number>();
  const withoutWeightByProject = new Map<string, number>();
  const assemblyCountByProject = new Map<string, number>();
  for (const row of totalRows) {
    totalByProject.set(row.projectId, toMinutes(row.piecesTotal));
    weightTotalByProject.set(row.projectId, row.weightTotalKg ?? 0);
    withoutWeightByProject.set(row.projectId, toMinutes(row.assembliesWithoutWeight));
    assemblyCountByProject.set(row.projectId, toMinutes(row.assemblyCount));
  }

  return {
    doneByProjectActivity,
    weightDoneByProjectActivity,
    totalByProject,
    weightTotalByProject,
    withoutWeightByProject,
    assemblyCountByProject,
    manualByProjectActivity,
    weightManualByProjectActivity,
    manualActivities,
  };
}

/**
 * Progress for one breakdown row, or null when the activity is not tracked
 * assembly by assembly. A tracked activity with nothing reported yet still
 * gets a row — "0 / 200" is the honest answer, and hiding it would read as
 * "not tracked".
 */
function assemblyProgressFor(
  index: ProjectAssemblyProgressIndex | undefined,
  row: ProjectSummarySqlRow,
): ProjectSummaryAssemblyProgress | null {
  if (!index || !row.activityId || !row.activityTracksAssemblies) {
    return null;
  }

  return buildAssemblyProgress(index, row.projectId, row.activityId);
}

function buildAssemblyProgress(
  index: ProjectAssemblyProgressIndex,
  projectId: string,
  activityId: string,
): ProjectSummaryAssemblyProgress {
  const key = assemblyKey(projectId, activityId);
  return {
    piecesDone: index.doneByProjectActivity.get(key) ?? 0,
    piecesTotal: index.totalByProject.get(projectId) ?? 0,
    weightDoneKg: index.weightDoneByProjectActivity.get(key) ?? 0,
    weightTotalKg: index.weightTotalByProject.get(projectId) ?? 0,
    assembliesWithoutWeight: index.withoutWeightByProject.get(projectId) ?? 0,
    piecesManual: index.manualByProjectActivity.get(key) ?? 0,
    weightManualKg: index.weightManualByProjectActivity.get(key) ?? 0,
  };
}

/**
 * Give a step done entirely outside the app its own breakdown row. It has no
 * hours behind it, so nothing in the timesheet query produced one — without
 * this, outsourced tonnage would have nowhere to show.
 */
function appendManualOnlyActivities(
  index: ProjectAssemblyProgressIndex | undefined,
  projects: Map<string, { id: string; activities: { activityId: string | null }[] }>,
): void {
  if (!index) {
    return;
  }

  for (const entry of index.manualActivities) {
    const project = projects.get(entry.projectId);
    if (!project) {
      continue;
    }
    if (project.activities.some((activity) => activity.activityId === entry.activityId)) {
      continue;
    }

    project.activities.push({
      activityId: entry.activityId,
      activityName: entry.activityName,
      activityColor: entry.activityColor,
      minutes: 0,
      assemblyProgress: buildAssemblyProgress(index, entry.projectId, entry.activityId),
    } as (typeof project.activities)[number]);
  }
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
      denumireLucrare: row.projectDenumireLucrare,
      finisaj: row.projectFinisaj,
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
  assemblyIndex?: ProjectAssemblyProgressIndex,
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
      assemblyProgress: assemblyProgressFor(assemblyIndex, row),
    });
  }

  appendManualOnlyActivities(assemblyIndex, byProject);

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
  assemblyIndex?: ProjectAssemblyProgressIndex,
): PinnedProjectsSummaryResponse {
  const byProject = new Map<string, PinnedProjectSummaryRow>();

  for (const row of rows) {
    const minutes = toMinutes(row.minutes);

    let project = byProject.get(row.projectId);
    if (!project) {
      project = {
        id: row.projectId,
        name: row.projectName,
        denumireLucrare: row.projectDenumireLucrare,
        finisaj: row.projectFinisaj,
        code: row.projectCode,
        color: row.projectColor,
        status: row.projectStatus as ProjectStatus,
        startDate: row.projectStartDate?.toISOString() ?? null,
        dueDate: row.projectDueDate?.toISOString() ?? null,
        indexPanou: row.projectIndexPanou ?? null,
        panouColumn: row.projectPanouColumn ?? null,
        readyForExecution: false,
        company: { id: row.companyId, name: row.companyName },
        visibleForRoles: [],
        assemblyCount: assemblyIndex?.assemblyCountByProject.get(row.projectId) ?? 0,
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
        assemblyProgress: assemblyProgressFor(assemblyIndex, row),
      });
    }
  }

  appendManualOnlyActivities(assemblyIndex, byProject);

  const projects = Array.from(byProject.values()).sort((left, right) => {
    const leftColumn = left.panouColumn ?? 0;
    const rightColumn = right.panouColumn ?? 0;
    if (leftColumn !== rightColumn) {
      return leftColumn - rightColumn;
    }

    const leftIndex = left.indexPanou ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = right.indexPanou ?? Number.MAX_SAFE_INTEGER;
    if (leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }
    return left.name.localeCompare(right.name, 'ro');
  });

  for (const project of projects) {
    project.activities.sort((left, right) => right.minutes - left.minutes);
  }

  return { projects };
}
