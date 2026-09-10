import { Prisma } from '@prisma/client';
import type {
  ActivityNormRow,
  ActivityNormsResponse,
} from '@fabxpert/shared/dto/report.dto';
import { PROJECT_COMPLETED_STATUSES } from '@fabxpert/shared/projectStatus';
import type { ResolvedNormsWindow } from './report-period.util';

const NO_ACTIVITY_LABEL = 'Fără activitate';

const completedStatuses = Prisma.join(
  PROJECT_COMPLETED_STATUSES.map((status) => Prisma.sql`${status}::"ProjectStatus"`),
);

export type NormProjectSqlRow = {
  projectId: string;
  /** The project's own weight, or what its assembly list adds up to. */
  weightKg: number | null;
  minutes: number | bigint;
};

export type NormActivitySqlRow = {
  projectId: string;
  activityId: string | null;
  activityName: string | null;
  activityColor: string | null;
  minutes: number | bigint;
};

/**
 * Delivered projects in the window, each with its weight and total hours.
 * The weight falls back to the assembly list for projects filled in before the
 * list started writing it.
 */
export function buildNormProjectsQuery(from: Date, toExclusive: Date): Prisma.Sql {
  return Prisma.sql`
    SELECT
      p.id AS "projectId",
      COALESCE(p.weight, list."weightKg") AS "weightKg",
      COALESCE(SUM(t."durationMinutes"), 0)::int AS minutes
    FROM projects p
    LEFT JOIN (
      SELECT
        pa."projectId" AS "projectId",
        SUM(pa.quantity * COALESCE(pa."weightPerPiece", 0))::float AS "weightKg"
      FROM project_assemblies pa
      WHERE pa."deletedAt" IS NULL
      GROUP BY pa."projectId"
    ) list ON list."projectId" = p.id
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
    GROUP BY p.id, list."weightKg"
  `;
}

/** The same hours, split by activity, so each step gets its own norm. */
export function buildNormActivitiesQuery(from: Date, toExclusive: Date): Prisma.Sql {
  return Prisma.sql`
    SELECT
      t."projectId" AS "projectId",
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
    GROUP BY t."projectId", t."activityId", a.name, a.color
  `;
}

function toNumber(value: number | bigint): number {
  return typeof value === 'bigint' ? Number(value) : value;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Linear-interpolated percentile over a sorted sample. Small samples are the
 * norm here — a handful of delivered projects per activity — so the quartiles
 * are read as "how much it varies", not as statistics.
 */
export function percentile(sorted: number[], fraction: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  if (sorted.length === 1) {
    return sorted[0];
  }

  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) {
    return sorted[lower];
  }
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

type ActivityTally = {
  activityId: string | null;
  activityName: string;
  color: string | null;
  minutes: number;
  tons: number;
  samples: number[];
};

export function shapeActivityNorms(
  window: ResolvedNormsWindow,
  projectRows: NormProjectSqlRow[],
  activityRows: NormActivitySqlRow[],
): ActivityNormsResponse {
  const tonsByProject = new Map<string, number>();
  let skippedWithoutWeight = 0;
  let totalTons = 0;
  let totalWorkedMinutes = 0;
  const overallSamples: number[] = [];

  for (const row of projectRows) {
    const minutes = toNumber(row.minutes);
    if (minutes <= 0) {
      // Nothing was logged against it, so it says nothing about how long the
      // work takes — not a missing weight, just not a data point.
      continue;
    }
    if (!row.weightKg || row.weightKg <= 0) {
      skippedWithoutWeight += 1;
      continue;
    }

    const tons = row.weightKg / 1000;
    tonsByProject.set(row.projectId, tons);
    totalTons += tons;
    totalWorkedMinutes += minutes;
    overallSamples.push(minutes / 60 / tons);
  }

  const activities = new Map<string, ActivityTally>();

  for (const row of activityRows) {
    const tons = tonsByProject.get(row.projectId);
    if (tons === undefined) {
      continue;
    }
    const minutes = toNumber(row.minutes);
    if (minutes <= 0) {
      continue;
    }

    const key = row.activityId ?? '';
    let tally = activities.get(key);
    if (!tally) {
      tally = {
        activityId: row.activityId,
        activityName: row.activityId
          ? (row.activityName ?? 'Activitate')
          : NO_ACTIVITY_LABEL,
        color: row.activityColor,
        minutes: 0,
        tons: 0,
        samples: [],
      };
      activities.set(key, tally);
    }

    tally.minutes += minutes;
    // Only the tonnage this activity actually touched, so an activity present
    // on two projects is not divided by the tonnage of all ten.
    tally.tons += tons;
    tally.samples.push(minutes / 60 / tons);
  }

  const rows: ActivityNormRow[] = Array.from(activities.values())
    .map((tally): ActivityNormRow => {
      const sorted = [...tally.samples].sort((left, right) => left - right);
      return {
        activityId: tally.activityId,
        activityName: tally.activityName,
        color: tally.color,
        projectCount: tally.samples.length,
        workedMinutes: tally.minutes,
        pooledHoursPerTon: round1(tally.minutes / 60 / tally.tons),
        medianHoursPerTon: round1(percentile(sorted, 0.5)),
        p25HoursPerTon: round1(percentile(sorted, 0.25)),
        p75HoursPerTon: round1(percentile(sorted, 0.75)),
      };
    })
    .sort((left, right) => right.workedMinutes - left.workedMinutes);

  const sortedOverall = [...overallSamples].sort((left, right) => left - right);

  return {
    from: window.fromDay,
    to: window.toDay,
    months: window.months,
    projectCount: tonsByProject.size,
    totalTons: round1(totalTons),
    totalWorkedMinutes,
    pooledHoursPerTon:
      totalTons > 0 ? round1(totalWorkedMinutes / 60 / totalTons) : null,
    medianHoursPerTon:
      sortedOverall.length > 0 ? round1(percentile(sortedOverall, 0.5)) : null,
    activities: rows,
    skippedWithoutWeight,
  };
}
