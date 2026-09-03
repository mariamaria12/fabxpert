'use client';

import type { ProjectSummaryActivityRow } from '@fabxpert/shared';
import { formatDurationMinutes } from '@/app/(app)/timesheets/timesheetFormat';
import { PanouActivityProgressBar } from './PanouActivityProgressBar';

/**
 * Name | percent | bar | pieces | hours. Every row feeds cells into this one
 * grid rather than owning its own, so the bars line up down the column no
 * matter how wide a row's piece count or duration happens to be. The plain
 * class is a hook for the enlarged pinned cards, which widen the numeric
 * columns in globals.css.
 */
const BREAKDOWN_GRID =
  'panou-breakdown-grid grid grid-cols-[minmax(0,1fr)_2.25rem_3.5rem_auto_auto] items-center gap-x-2 gap-y-2';

/**
 * A tracked activity on a project whose list was never imported has nothing to
 * report — an empty bar there would read as "no progress" rather than "no
 * list", so it falls back to the plain hours row.
 *
 * Absent counts as "nothing to report" too: web and API ship separately, so a
 * fresh page can be served rows from an API that predates this field.
 */
function hasAssemblyInfo(activity: ProjectSummaryActivityRow): boolean {
  const progress = activity.assemblyProgress;
  if (!progress) {
    return false;
  }

  return progress.piecesTotal > 0 || progress.piecesDone > 0;
}

/** Over-reported pieces fill the bar rather than overflow it; the fraction still shows the excess. */
function toPercent(done: number, total: number): number {
  return total > 0 ? Math.min(Math.round((done / total) * 100), 100) : 0;
}

function ActivityDot({ color }: { color: string | null }) {
  return (
    <span
      className="size-1.5 shrink-0 rounded-full"
      style={{ backgroundColor: color ?? 'var(--color-border-subtle)' }}
      aria-hidden="true"
    />
  );
}

/** Pieces closed on the project's list, with the period's hours beside them. Same colors as the hours rows so the two halves read as one list. */
function AssemblyActivityCells({ activity }: { activity: ProjectSummaryActivityRow }) {
  const progress = activity.assemblyProgress;
  if (!progress) {
    return null;
  }

  const { piecesDone, piecesTotal } = progress;
  const hasList = piecesTotal > 0;
  const percent = toPercent(piecesDone, piecesTotal);

  return (
    <>
      <div className="flex min-w-0 items-center gap-2">
        <ActivityDot color={activity.activityColor} />
        <span className="truncate text-xs text-text-secondary">{activity.activityName}</span>
      </div>
      <span className="text-right text-[11px] tabular-nums text-text-muted">
        {hasList ? `${percent}%` : ''}
      </span>
      <PanouActivityProgressBar
        className="w-full"
        color={activity.activityColor}
        percent={percent}
      />
      <span className="whitespace-nowrap font-mono text-[11px] tabular-nums text-text-muted">
        {hasList ? `${piecesDone} / ${piecesTotal} buc.` : `${piecesDone} buc.`}
      </span>
      <span className="text-right font-mono text-[11px] tabular-nums text-text-muted">
        {formatDurationMinutes(activity.minutes)}
      </span>
    </>
  );
}

/** Everything not tracked assembly by assembly: the bar just compares hours. */
function ActivityHoursCells({
  activity,
  percent,
}: {
  activity: ProjectSummaryActivityRow;
  percent: number;
}) {
  return (
    <>
      <div className="flex min-w-0 items-center gap-2">
        <ActivityDot color={activity.activityColor} />
        <span className="truncate text-xs text-text-secondary">{activity.activityName}</span>
      </div>
      <span aria-hidden="true" />
      <PanouActivityProgressBar
        className="w-full"
        color={activity.activityColor}
        percent={percent}
      />
      <span aria-hidden="true" />
      <span className="text-right font-mono text-[11px] tabular-nums text-text-muted">
        {formatDurationMinutes(activity.minutes)}
      </span>
    </>
  );
}

/**
 * The whole fabrication flow in one line: every tracked activity has to cover
 * the same list, so the denominator is the list once per activity.
 */
function AssemblyTotalCells({ activities }: { activities: ProjectSummaryActivityRow[] }) {
  const piecesDone = activities.reduce(
    (sum, activity) => sum + (activity.assemblyProgress?.piecesDone ?? 0),
    0,
  );
  const piecesTotal = activities.reduce(
    (sum, activity) => sum + (activity.assemblyProgress?.piecesTotal ?? 0),
    0,
  );
  const percent = toPercent(piecesDone, piecesTotal);

  return (
    <>
      <span className="truncate pl-[14px] text-xs text-text-muted">Progres total ansamble</span>
      <span className="text-right text-[11px] tabular-nums text-text-muted">
        {piecesTotal > 0 ? `${percent}%` : ''}
      </span>
      <PanouActivityProgressBar
        className="w-full"
        color="var(--color-success-icon)"
        percent={percent}
      />
      <span className="whitespace-nowrap font-mono text-[11px] tabular-nums text-text-muted">
        {piecesDone} / {piecesTotal} buc.
      </span>
      <span aria-hidden="true" />
    </>
  );
}

export function ActivityBreakdownRows({
  activities,
}: {
  activities: ProjectSummaryActivityRow[];
}) {
  const assemblyActivities = activities.filter(hasAssemblyInfo);
  const hoursActivities = activities.filter((activity) => !hasAssemblyInfo(activity));

  // Scaled against the plain rows only — an assembly row's hours would
  // otherwise flatten every bar below it.
  const maxActivityMinutes = Math.max(...hoursActivities.map((activity) => activity.minutes), 1);

  return (
    <div className={BREAKDOWN_GRID}>
      {assemblyActivities.length > 0 && (
        <>
          <span className="text-[10px] uppercase tracking-wide text-text-muted">Activitate</span>
          <span className="col-span-3 text-[10px] uppercase tracking-wide text-text-muted">
            Progres
          </span>
          <span className="text-right text-[10px] uppercase tracking-wide text-text-muted">
            Logat
          </span>

          {assemblyActivities.map((activity) => (
            <AssemblyActivityCells key={activity.activityId ?? 'none'} activity={activity} />
          ))}

          {assemblyActivities.length > 1 && (
            <>
              <hr className="col-span-5 border-t border-border-subtle" />
              <AssemblyTotalCells activities={assemblyActivities} />
            </>
          )}
        </>
      )}

      {assemblyActivities.length > 0 && hoursActivities.length > 0 && (
        <hr className="col-span-5 border-t border-border-subtle" />
      )}

      {hoursActivities.map((activity) => (
        <ActivityHoursCells
          key={activity.activityId ?? 'none'}
          activity={activity}
          percent={Math.round((activity.minutes / maxActivityMinutes) * 100)}
        />
      ))}
    </div>
  );
}
