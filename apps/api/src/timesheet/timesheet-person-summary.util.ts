import { Prisma } from '@prisma/client';
import type { PersonSummaryResponse, TimesheetSummaryPeriod } from '@fabxpert/shared/dto/timesheet.dto';

export type PersonSummarySqlRow = {
  personId: string;
  firstName: string;
  lastName: string;
  activityId: string | null;
  activityName: string | null;
  activityColor: string | null;
  minutes: number | bigint;
};

const NO_ACTIVITY_LABEL = 'Fără activitate';

export function buildPersonSummaryQuery(from: Date | null, to: Date | null) {
  const periodFilter =
    from && to
      ? Prisma.sql`AND t."startTime" >= ${from} AND t."startTime" < ${to}`
      : Prisma.empty;

  return Prisma.sql`
    SELECT
      pe.id AS "personId",
      pe."firstName" AS "firstName",
      pe."lastName" AS "lastName",
      t."activityId" AS "activityId",
      a.name AS "activityName",
      a.color AS "activityColor",
      FLOOR(
        SUM(EXTRACT(EPOCH FROM (t."endTime" - t."startTime"))) / 60
      )::int AS minutes
    FROM timesheets t
    INNER JOIN persons pe ON pe.id = t."personId"
    LEFT JOIN activities a ON a.id = t."activityId"
    WHERE t."deletedAt" IS NULL
      AND t."endTime" IS NOT NULL
      AND pe."deletedAt" IS NULL
      ${periodFilter}
    GROUP BY
      pe.id,
      pe."firstName",
      pe."lastName",
      t."activityId",
      a.name,
      a.color
    ORDER BY pe.id ASC, minutes DESC
  `;
}

function toMinutes(value: number | bigint): number {
  return typeof value === 'bigint' ? Number(value) : value;
}

export function shapePersonSummary(
  rows: PersonSummarySqlRow[],
  period: TimesheetSummaryPeriod,
): PersonSummaryResponse {
  const byPerson = new Map<
    string,
    PersonSummaryResponse['persons'][number]
  >();

  for (const row of rows) {
    const minutes = toMinutes(row.minutes);
    if (minutes <= 0) {
      continue;
    }

    let person = byPerson.get(row.personId);
    if (!person) {
      person = {
        id: row.personId,
        firstName: row.firstName,
        lastName: row.lastName,
        totalMinutes: 0,
        activities: [],
      };
      byPerson.set(row.personId, person);
    }

    person.totalMinutes += minutes;
    person.activities.push({
      activityId: row.activityId,
      activityName: row.activityId ? (row.activityName ?? 'Activitate') : NO_ACTIVITY_LABEL,
      activityColor: row.activityColor,
      minutes,
    });
  }

  const persons = Array.from(byPerson.values())
    .filter((person) => person.totalMinutes > 0)
    .sort((left, right) => right.totalMinutes - left.totalMinutes);

  for (const person of persons) {
    person.activities.sort((left, right) => right.minutes - left.minutes);
  }

  return { period, persons };
}
