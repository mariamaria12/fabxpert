'use client';

import type { ActivityDto } from '@fabxpert/shared';
import { FORM_LABEL_CLASS } from '@/components/formFieldStyles';

interface TrackedActivitiesFieldProps {
  /** Activities flagged as tracking assemblies — the project's default set. */
  activities: ActivityDto[];
  untrackedActivityIds: string[];
  /** Pieces already logged per activity; null while unknown. */
  piecesByActivity: Map<string, number> | null;
  loading: boolean;
  disabled: boolean;
  onChange: (untrackedActivityIds: string[]) => void;
}

/**
 * Which assembly-tracking activities apply to this project. All are ticked by
 * default; an unticked one is logged with hours only and leaves the progress,
 * e.g. painting on a galvanised project.
 */
export function TrackedActivitiesField({
  activities,
  untrackedActivityIds,
  piecesByActivity,
  loading,
  disabled,
  onChange,
}: TrackedActivitiesFieldProps) {
  function toggle(activityId: string, tracked: boolean) {
    onChange(
      tracked
        ? untrackedActivityIds.filter((id) => id !== activityId)
        : [...untrackedActivityIds, activityId],
    );
  }

  return (
    <div>
      <span className={FORM_LABEL_CLASS}>Activități cu ansamble</span>
      {loading ? (
        <p className="text-sm text-text-muted">…</p>
      ) : activities.length === 0 ? (
        <p className="text-sm text-text-muted">Nicio activitate nu urmărește ansamble.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {activities.map((activity) => {
            const tracked = !untrackedActivityIds.includes(activity.id);
            const pieces = piecesByActivity?.get(activity.id) ?? 0;

            return (
              <li key={activity.id}>
                <label className="inline-flex items-center gap-2 text-sm text-text-secondary">
                  <input
                    type="checkbox"
                    checked={tracked}
                    disabled={disabled}
                    onChange={(event) => toggle(activity.id, event.target.checked)}
                    className="size-4 rounded border-border accent-accent"
                  />
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: activity.color ?? 'var(--color-text-muted)' }}
                    aria-hidden="true"
                  />
                  {activity.name}
                </label>
                {!tracked && pieces > 0 && (
                  <p className="mt-1 ml-6 text-xs text-warning-text">
                    {pieces === 1 ? 'O bucată logată' : `${pieces} bucăți logate`} pe{' '}
                    {activity.name} nu mai intră în progres. Nu se șterg: revin dacă bifezi din nou.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-1.5 text-xs text-text-muted">
        Pe activitățile debifate se pontează doar ore, fără ansamble, și nu intră în calculul
        progresului.
      </p>
    </div>
  );
}
