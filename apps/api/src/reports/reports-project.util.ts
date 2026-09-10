import { Prisma } from '@prisma/client';
import type {
  AssemblyStepProgress,
  ProjectReportActivityRow,
  ProjectReportPersonRow,
  ProjectReportResponse,
} from '@fabxpert/shared/dto/report.dto';
import type { ProjectStatus } from '@fabxpert/shared/dto/project.dto';
import type { ProjectAssemblyProgressIndex } from '../timesheet/timesheet-project-summary.util';

const NO_ACTIVITY_LABEL = 'Fără activitate';

/** One person's time on the project, split by activity. */
export type ProjectReportEntrySqlRow = {
  personId: string;
  firstName: string;
  lastName: string;
  roleName: string | null;
  activityId: string | null;
  activityName: string | null;
  activityColor: string | null;
  /** Null when the entry carries no activity at all. */
  activityTracksAssemblies: boolean | null;
  minutes: number | bigint;
  firstWorkDate: Date;
  lastWorkDate: Date;
};

export type ProjectReportProject = {
  id: string;
  code: string;
  name: string;
  denumireLucrare: string | null;
  status: ProjectStatus;
  startDate: Date | null;
  dueDate: Date | null;
  completedAt: Date | null;
  weight: number | null;
  estimatedHours: number | null;
  companyName: string;
};

/**
 * Every timesheet on the project, grouped by person and activity — the two
 * dimensions the fișa crosses. Deliberately unbounded in time: the fișa is the
 * whole life of the project, not an interval of it.
 */
export function buildProjectReportEntriesQuery(projectId: string): Prisma.Sql {
  return Prisma.sql`
    SELECT
      t."personId" AS "personId",
      pe."firstName" AS "firstName",
      pe."lastName" AS "lastName",
      er.name AS "roleName",
      t."activityId" AS "activityId",
      a.name AS "activityName",
      a.color AS "activityColor",
      a."tracksAssemblies" AS "activityTracksAssemblies",
      SUM(t."durationMinutes")::int AS minutes,
      MIN(t."workDate") AS "firstWorkDate",
      MAX(t."workDate") AS "lastWorkDate"
    FROM timesheets t
    INNER JOIN persons pe ON pe.id = t."personId" AND pe."deletedAt" IS NULL
    LEFT JOIN employee_roles er ON er.id = pe."employeeRoleId"
    LEFT JOIN activities a ON a.id = t."activityId"
    WHERE t."deletedAt" IS NULL
      AND t."projectId" = ${projectId}
    GROUP BY
      t."personId",
      pe."firstName",
      pe."lastName",
      er.name,
      t."activityId",
      a.name,
      a.color,
      a."tracksAssemblies"
  `;
}

function toNumber(value: number | bigint): number {
  return typeof value === 'bigint' ? Number(value) : value;
}

function dayKey(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Hours per ton, to one decimal; null while the project carries no weight. */
export function hoursPerTon(workedMinutes: number, weightKg: number | null): number | null {
  if (!weightKg || weightKg <= 0 || workedMinutes <= 0) {
    return null;
  }
  const tons = weightKg / 1000;
  return Math.round((workedMinutes / 60 / tons) * 10) / 10;
}

/** The activity key, with a single bucket for entries that carry none. */
function activityKey(activityId: string | null): string {
  return activityId ?? '';
}

function stepProgress(
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

type ActivityTally = {
  activityId: string | null;
  activityName: string;
  color: string | null;
  tracksAssemblies: boolean;
  minutes: number;
};

export function shapeProjectReport(
  project: ProjectReportProject,
  rows: ProjectReportEntrySqlRow[],
  assemblyIndex: ProjectAssemblyProgressIndex,
): ProjectReportResponse {
  const activities = new Map<string, ActivityTally>();
  const persons = new Map<
    string,
    ProjectReportPersonRow & { activityMinutes: Map<string, number> }
  >();

  let workedMinutes = 0;
  let firstWorkDate: Date | null = null;
  let lastWorkDate: Date | null = null;

  for (const row of rows) {
    const minutes = toNumber(row.minutes);
    if (minutes <= 0) {
      continue;
    }
    workedMinutes += minutes;

    if (!firstWorkDate || row.firstWorkDate < firstWorkDate) {
      firstWorkDate = row.firstWorkDate;
    }
    if (!lastWorkDate || row.lastWorkDate > lastWorkDate) {
      lastWorkDate = row.lastWorkDate;
    }

    const key = activityKey(row.activityId);
    const activity = activities.get(key);
    if (activity) {
      activity.minutes += minutes;
    } else {
      activities.set(key, {
        activityId: row.activityId,
        activityName: row.activityId
          ? (row.activityName ?? 'Activitate')
          : NO_ACTIVITY_LABEL,
        color: row.activityColor,
        tracksAssemblies: row.activityTracksAssemblies ?? false,
        minutes,
      });
    }

    let person = persons.get(row.personId);
    if (!person) {
      person = {
        personId: row.personId,
        personName: `${row.firstName} ${row.lastName}`.trim(),
        roleName: row.roleName,
        workedMinutes: 0,
        byActivity: [],
        activityMinutes: new Map(),
      };
      persons.set(row.personId, person);
    }
    person.workedMinutes += minutes;
    person.activityMinutes.set(key, (person.activityMinutes.get(key) ?? 0) + minutes);
  }

  // A step done entirely outside the app has no hours behind it, so nothing
  // above produced a row for it. Without this its tonnage would vanish.
  for (const manual of assemblyIndex.manualActivities) {
    if (manual.projectId !== project.id) {
      continue;
    }
    const key = activityKey(manual.activityId);
    if (activities.has(key)) {
      continue;
    }
    activities.set(key, {
      activityId: manual.activityId,
      activityName: manual.activityName,
      color: manual.activityColor,
      tracksAssemblies: true,
      minutes: 0,
    });
  }

  const byActivity: ProjectReportActivityRow[] = Array.from(activities.values())
    .map((activity) => ({
      activityId: activity.activityId,
      activityName: activity.activityName,
      color: activity.color,
      workedMinutes: activity.minutes,
      progress:
        activity.activityId && activity.tracksAssemblies
          ? stepProgress(assemblyIndex, project.id, activity.activityId)
          : null,
    }))
    .sort((left, right) => right.workedMinutes - left.workedMinutes);

  const byPerson: ProjectReportPersonRow[] = Array.from(persons.values())
    .map((person) => ({
      personId: person.personId,
      personName: person.personName,
      roleName: person.roleName,
      workedMinutes: person.workedMinutes,
      byActivity: byActivity
        .map((activity) => ({
          activityId: activity.activityId,
          minutes: person.activityMinutes.get(activityKey(activity.activityId)) ?? 0,
        }))
        .filter((cell) => cell.minutes > 0),
    }))
    .sort((left, right) => right.workedMinutes - left.workedMinutes);

  const estimatedMinutes =
    project.estimatedHours === null ? null : Math.round(project.estimatedHours * 60);
  const weightKg = project.weight ?? assemblyIndex.weightTotalByProject.get(project.id) ?? null;

  return {
    project: {
      id: project.id,
      code: project.code,
      label: project.denumireLucrare ?? project.name,
      companyName: project.companyName,
      status: project.status,
      startDate: project.startDate?.toISOString() ?? null,
      dueDate: project.dueDate?.toISOString() ?? null,
      completedAt: project.completedAt?.toISOString() ?? null,
      weightKg: weightKg && weightKg > 0 ? weightKg : null,
    },
    totals: {
      workedMinutes,
      estimatedMinutes,
      efficiencyPct:
        estimatedMinutes !== null && workedMinutes > 0
          ? Math.round((estimatedMinutes / workedMinutes) * 100)
          : null,
      hoursPerTon: hoursPerTon(workedMinutes, weightKg),
      peopleCount: byPerson.length,
      firstWorkDay: firstWorkDate ? dayKey(firstWorkDate) : null,
      lastWorkDay: lastWorkDate ? dayKey(lastWorkDate) : null,
    },
    byActivity,
    byPerson,
  };
}
