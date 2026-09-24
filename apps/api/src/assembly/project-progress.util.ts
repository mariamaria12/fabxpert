import { Prisma, type PrismaClient } from '@prisma/client';
import { projectProgressPercent } from '@fabxpert/shared/assemblyProgress';
import {
  computeProgressCalibration,
  sharesForActivities,
  type ProgressCalibrationSample,
} from '@fabxpert/shared/progressCalibration';
import { PROJECT_COMPLETED_STATUSES } from '@fabxpert/shared/projectStatus';

type Db = PrismaClient | Prisma.TransactionClient;

/** How far back delivered projects are read when the formula is recalibrated. */
const CALIBRATION_WINDOW_MONTHS = 24;

/**
 * The stored figures only change when a project is delivered, so they are kept
 * in memory instead of read on every list. The time limit is a safety net for
 * a second API instance that did not run the recalibration itself.
 */
const CALIBRATION_CACHE_MS = 10 * 60 * 1000;
let cachedCalibration: { value: StoredProgressCalibration; loadedAt: number } | null = null;

const completedStatuses = Prisma.join(
  PROJECT_COMPLETED_STATUSES.map((status) => Prisma.sql`${status}::"ProjectStatus"`),
);

export type StoredProgressCalibration = {
  fixedWeightKg: number;
  activityWeights: Record<string, number>;
};

function trackedActivityIds(db: Db): Promise<string[]> {
  return db.activity
    .findMany({
      where: { tracksAssemblies: true, isActive: true, deletedAt: null },
      select: { id: true },
    })
    .then((rows) => rows.map((row) => row.id));
}

/**
 * Works the formula's figures out again from the delivered projects of the
 * last CALIBRATION_WINDOW_MONTHS and stores them as the new latest row. Called
 * when a project is delivered or taken back — never while rendering.
 */
export async function recalibrateProjectProgress(db: Db): Promise<StoredProgressCalibration> {
  const since = new Date();
  since.setMonth(since.getMonth() - CALIBRATION_WINDOW_MONTHS);
  const activityIds = await trackedActivityIds(db);

  const [projects, minutes] = await Promise.all([
    db.$queryRaw<{ projectId: string; weightKg: number | null; pieces: number | null }[]>(Prisma.sql`
      SELECT
        p.id AS "projectId",
        COALESCE(p.weight, list."weightKg") AS "weightKg",
        -- Pieces only count when every line carries a weight, or kilograms and
        -- pieces would describe two different lists.
        CASE WHEN list."withoutWeight" = 0 THEN list.pieces END AS pieces
      FROM projects p
      LEFT JOIN (
        SELECT
          pa."projectId",
          SUM(pa.quantity * COALESCE(pa."weightPerPiece", 0))::float AS "weightKg",
          SUM(pa.quantity)::int AS pieces,
          COUNT(*) FILTER (WHERE pa."weightPerPiece" IS NULL)::int AS "withoutWeight"
        FROM project_assemblies pa
        WHERE pa."deletedAt" IS NULL
        GROUP BY pa."projectId"
      ) list ON list."projectId" = p.id
      WHERE p."deletedAt" IS NULL
        AND p.status IN (${completedStatuses})
        AND p."completedAt" >= ${since}
    `),
    db.$queryRaw<{ projectId: string; activityId: string; minutes: number }[]>(Prisma.sql`
      SELECT t."projectId", t."activityId", SUM(t."durationMinutes")::int AS minutes
      FROM timesheets t
      INNER JOIN persons pe ON pe.id = t."personId" AND pe."deletedAt" IS NULL
      INNER JOIN projects p ON p.id = t."projectId"
        AND p."deletedAt" IS NULL
        AND p.status IN (${completedStatuses})
        AND p."completedAt" >= ${since}
      INNER JOIN activities a ON a.id = t."activityId" AND a."tracksAssemblies"
      WHERE t."deletedAt" IS NULL
      GROUP BY t."projectId", t."activityId"
    `),
  ]);

  const minutesByProject = new Map<string, Record<string, number>>();
  for (const row of minutes) {
    const byActivity = minutesByProject.get(row.projectId) ?? {};
    byActivity[row.activityId] = row.minutes;
    minutesByProject.set(row.projectId, byActivity);
  }

  const samples: ProgressCalibrationSample[] = projects.map((project) => ({
    weightKg: project.weightKg,
    pieces: project.pieces,
    minutesByActivity: minutesByProject.get(project.projectId) ?? {},
  }));
  const result = computeProgressCalibration(samples, activityIds);

  const stored = { fixedWeightKg: result.fixedWeightKg, activityWeights: result.activityWeights };
  await db.progressCalibration.create({
    data: {
      fixedWeightKg: result.fixedWeightKg,
      fixedWeightFromData: result.fixedWeightFromData,
      activityWeights: result.activityWeights,
      activityWeightsFromData: result.activityWeightsFromData,
      projectCount: result.projectCount,
      excludedProjectCount: result.excludedProjectCount,
    },
  });

  cachedCalibration = { value: stored, loadedAt: Date.now() };
  return stored;
}

/** The latest stored figures; the first read on an empty table works them out once. */
async function loadProgressCalibration(db: Db): Promise<StoredProgressCalibration> {
  if (cachedCalibration && Date.now() - cachedCalibration.loadedAt < CALIBRATION_CACHE_MS) {
    return cachedCalibration.value;
  }
  const latest = await db.progressCalibration.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { fixedWeightKg: true, activityWeights: true },
  });
  if (!latest) {
    return recalibrateProjectProgress(db);
  }
  const value = {
    fixedWeightKg: latest.fixedWeightKg,
    activityWeights: latest.activityWeights as Record<string, number>,
  };
  cachedCalibration = { value, loadedAt: Date.now() };
  return value;
}

type ProjectProgressSqlRow = {
  /** Null on the rows that only name a tracked activity. */
  projectId: string | null;
  /** Null on the row that only carries the list total. */
  activityId: string | null;
  equivalentKg: number | null;
};

/**
 * Progress per project, 0–100, for the projects that have an assembly list.
 * Every piece counts as its weight plus the calibrated fixed part, and each
 * tracked activity closes the whole list, weighted by its calibrated share.
 * Done pieces come from both sources — timesheets and manual ticks — and are
 * capped at the line's quantity, so an over-reported line cannot carry the
 * rest of the list. Projects without a list are simply absent from the map.
 */
export async function loadProjectProgress(
  db: Db,
  projectIds: string[],
): Promise<Map<string, number>> {
  const progress = new Map<string, number>();
  if (projectIds.length === 0) {
    return progress;
  }

  const calibration = await loadProgressCalibration(db);
  const fixedWeightKg = calibration.fixedWeightKg;

  const rows = await db.$queryRaw<ProjectProgressSqlRow[]>(Prisma.sql`
    WITH tracked AS (
      SELECT id FROM activities
      WHERE "tracksAssemblies" AND "isActive" AND "deletedAt" IS NULL
    ),
    list AS (
      SELECT pa.id, pa."projectId", pa.quantity,
        COALESCE(pa."weightPerPiece", 0) + ${fixedWeightKg} AS "pieceKg"
      FROM project_assemblies pa
      WHERE pa."deletedAt" IS NULL
        AND pa."projectId" IN (${Prisma.join(projectIds)})
    ),
    -- Read only the assemblies on this page's lists, not the whole table.
    done AS (
      SELECT src."assemblyId", src."activityId", SUM(src.quantity) AS quantity
      FROM (
        SELECT ta."assemblyId", ta."activityId", ta."quantityDone" AS quantity
        FROM timesheet_assemblies ta
        INNER JOIN list ON list.id = ta."assemblyId"
        INNER JOIN timesheets t ON t.id = ta."timesheetId" AND t."deletedAt" IS NULL
        UNION ALL
        SELECT amp."assemblyId", amp."activityId", amp."quantityDone" AS quantity
        FROM assembly_manual_progress amp
        INNER JOIN list ON list.id = amp."assemblyId"
      ) src
      INNER JOIN tracked a ON a.id = src."activityId"
      GROUP BY src."assemblyId", src."activityId"
    )
    -- The tracked activities ride along, so the shares need no second trip.
    SELECT NULL AS "projectId", tracked.id AS "activityId", NULL::float AS "equivalentKg"
    FROM tracked
    UNION ALL
    SELECT list."projectId", NULL AS "activityId",
      SUM(list.quantity * list."pieceKg")::float AS "equivalentKg"
    FROM list
    GROUP BY list."projectId"
    UNION ALL
    SELECT list."projectId", done."activityId",
      SUM(LEAST(done.quantity, list.quantity) * list."pieceKg")::float AS "equivalentKg"
    FROM list
    INNER JOIN done ON done."assemblyId" = list.id
    GROUP BY list."projectId", done."activityId"
  `);

  const activityIds: string[] = [];
  const totals = new Map<string, number>();
  const doneByProject = new Map<string, Record<string, number>>();
  for (const row of rows) {
    if (row.projectId === null) {
      if (row.activityId !== null) {
        activityIds.push(row.activityId);
      }
      continue;
    }
    if (row.activityId === null) {
      totals.set(row.projectId, row.equivalentKg ?? 0);
      continue;
    }
    const byActivity = doneByProject.get(row.projectId) ?? {};
    byActivity[row.activityId] = row.equivalentKg ?? 0;
    doneByProject.set(row.projectId, byActivity);
  }

  const activityShares = sharesForActivities(calibration.activityWeights, activityIds);
  for (const [projectId, totalEquivalentKg] of totals) {
    const percent = projectProgressPercent({
      doneEquivalentKgByActivity: doneByProject.get(projectId) ?? {},
      totalEquivalentKg,
      activityShares,
    });
    if (percent !== null) {
      progress.set(projectId, percent);
    }
  }

  return progress;
}
