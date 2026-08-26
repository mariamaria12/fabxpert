import type {
  TimesheetDayGroupDto,
  TimesheetDto,
} from '@fabxpert/shared/dto/timesheet.dto';
import { workDateToDayKey } from '@fabxpert/shared/workDate';

const NO_ACTIVITY_LABEL = 'Fără activitate';

/** Group key — one row per person per day. */
export function dayGroupKey(personId: string, workDate: Date | string): string {
  return `${personId}:${workDateToDayKey(workDate)}`;
}

/**
 * Folds a day's entries into the row the Pontaje list shows: totals for the day
 * plus a per-activity breakdown. `entries` must already be scoped to a single
 * person and day, oldest first.
 */
export function shapeDayGroup(entries: TimesheetDto[]): TimesheetDayGroupDto {
  const first = entries[0]!;
  const activityMinutes = new Map<
    string,
    { activityId: string | null; activityName: string; activityColor: string | null; minutes: number }
  >();
  let totalMinutes = 0;

  for (const entry of entries) {
    totalMinutes += entry.durationMinutes;

    // Entries without an activity all fold into one bucket.
    const key = entry.activityId ?? '';
    const bucket = activityMinutes.get(key);
    if (bucket) {
      bucket.minutes += entry.durationMinutes;
      continue;
    }

    activityMinutes.set(key, {
      activityId: entry.activityId,
      activityName: entry.activity?.name ?? NO_ACTIVITY_LABEL,
      activityColor: entry.activity?.color ?? null,
      minutes: entry.durationMinutes,
    });
  }

  return {
    id: dayGroupKey(first.personId, first.workDate),
    workDate: first.workDate,
    person: first.person,
    entryCount: entries.length,
    totalMinutes,
    entries,
    activityTotals: Array.from(activityMinutes.values()).sort(
      (left, right) => right.minutes - left.minutes,
    ),
  };
}
